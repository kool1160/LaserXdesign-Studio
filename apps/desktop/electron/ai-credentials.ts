import { spawn } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface CredentialVaultPort {
  read(providerId: string): Promise<string | null>;
  write(providerId: string, credential: string): Promise<void>;
  delete(providerId: string): Promise<void>;
}

export interface SafeStoragePort {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

interface StoredCredentialEnvelope {
  schemaVersion: 1;
  providerId: string;
  encryptedBase64: string;
}

function safeProviderId(providerId: string): string {
  const normalized = providerId.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,50}$/u.test(normalized)) {
    throw new RangeError("Credential provider ID is invalid.");
  }
  return normalized;
}

export class ElectronCredentialVault implements CredentialVaultPort {
  readonly #safeStorage: SafeStoragePort;
  readonly #vaultPath: string;

  public constructor(userDataPath: string, safeStorage: SafeStoragePort) {
    this.#safeStorage = safeStorage;
    this.#vaultPath = join(userDataPath, "credentials", "ai-provider.json");
  }

  public async read(providerId: string): Promise<string | null> {
    const normalized = safeProviderId(providerId);
    let serialized: string;
    try {
      serialized = await readFile(this.#vaultPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new Error("The operating-system credential vault could not be read.", {
        cause: error,
      });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error("The stored AI credential envelope is corrupt.");
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as Partial<StoredCredentialEnvelope>).schemaVersion !== 1 ||
      (parsed as Partial<StoredCredentialEnvelope>).providerId !== normalized ||
      typeof (parsed as Partial<StoredCredentialEnvelope>).encryptedBase64 !== "string"
    ) {
      throw new Error("The stored AI credential envelope is invalid.");
    }
    if (!this.#safeStorage.isEncryptionAvailable()) {
      throw new Error("Operating-system credential encryption is unavailable.");
    }
    try {
      return this.#safeStorage.decryptString(Buffer.from(
        (parsed as StoredCredentialEnvelope).encryptedBase64,
        "base64",
      ));
    } catch (error) {
      throw new Error("The operating-system credential vault could not decrypt the AI key.", {
        cause: error,
      });
    }
  }

  public async write(providerId: string, credential: string): Promise<void> {
    const normalized = safeProviderId(providerId);
    const secret = credential.trim();
    if (secret.length < 20 || /[\r\n]/u.test(secret)) {
      throw new RangeError("The AI credential format is invalid.");
    }
    if (!this.#safeStorage.isEncryptionAvailable()) {
      throw new Error("Operating-system credential encryption is unavailable.");
    }
    const envelope: StoredCredentialEnvelope = {
      schemaVersion: 1,
      providerId: normalized,
      encryptedBase64: this.#safeStorage.encryptString(secret).toString("base64"),
    };
    const temporaryPath = `${this.#vaultPath}.tmp`;
    await mkdir(dirname(this.#vaultPath), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(envelope)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.#vaultPath);
  }

  public async delete(providerId: string): Promise<void> {
    safeProviderId(providerId);
    await rm(this.#vaultPath, { force: true });
  }
}

export interface CredentialAcquisitionPort {
  acquire(providerName: string, replacing: boolean): Promise<string | null>;
}

const WINDOWS_CREDENTIAL_PROMPT = String.raw`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = 'LaserX OpenAI connection'
$form.Width = 520
$form.Height = 210
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$label = New-Object System.Windows.Forms.Label
$label.Left = 18
$label.Top = 20
$label.Width = 470
$label.Height = 42
$label.Text = 'Paste the dedicated OpenAI API key. It will be encrypted with Windows and never sent to the LaserX renderer.'
$box = New-Object System.Windows.Forms.TextBox
$box.Left = 18
$box.Top = 72
$box.Width = 470
$box.UseSystemPasswordChar = $true
$ok = New-Object System.Windows.Forms.Button
$ok.Text = 'Store key'
$ok.Left = 300
$ok.Top = 112
$ok.Width = 90
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = 'Cancel'
$cancel.Left = 398
$cancel.Top = 112
$cancel.Width = 90
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.AddRange(@($label, $box, $ok, $cancel))
$form.AcceptButton = $ok
$form.CancelButton = $cancel
$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $box.Text.Length -gt 0) {
  [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($box.Text))
}
$box.Text = ''
$form.Dispose()
`;

export class WindowsCredentialAcquisition implements CredentialAcquisitionPort {
  public acquire(): Promise<string | null> {
    return new Promise((resolveResult, reject) => {
      const encoded = Buffer.from(WINDOWS_CREDENTIAL_PROMPT, "utf16le").toString("base64");
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Sta", "-EncodedCommand", encoded],
        { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
      );
      const output: Buffer[] = [];
      let outputBytes = 0;
      child.stdout.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes <= 16_384) output.push(chunk);
      });
      child.stderr.resume();
      child.once("error", () => {
        reject(new Error("The secure Windows credential prompt could not be opened."));
      });
      child.once("close", (code) => {
        if (code !== 0 || outputBytes > 16_384) {
          reject(new Error("The secure Windows credential prompt failed."));
          return;
        }
        const value = Buffer.concat(output).toString("utf8").trim();
        if (value.length === 0) {
          resolveResult(null);
          return;
        }
        try {
          resolveResult(Buffer.from(value, "base64").toString("utf8"));
        } catch {
          reject(new Error("The secure Windows credential prompt returned invalid data."));
        }
      });
    });
  }
}
