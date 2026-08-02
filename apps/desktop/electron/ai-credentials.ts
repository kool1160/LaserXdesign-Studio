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
  acquire(
    providerName: string,
    replacing: boolean,
    signal: AbortSignal,
  ): Promise<string | null>;
}

export class CredentialAcquisitionCancelledError extends Error {
  public constructor() {
    super("AI credential connection was canceled; the previous connection was restored.");
    this.name = "CredentialAcquisitionCancelledError";
  }
}

export class CredentialAcquisitionTimeoutError extends Error {
  public constructor() {
    super("The secure credential prompt timed out; retry when you are ready.");
    this.name = "CredentialAcquisitionTimeoutError";
  }
}
