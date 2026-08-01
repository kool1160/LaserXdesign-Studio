import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ElectronCredentialVault,
  type SafeStoragePort,
} from "../../electron/ai-credentials.js";

const SECRET = "sk-test-never-plain-text-1234567890";

const safeStorage: SafeStoragePort = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`encrypted:${value}`, "utf8"),
  decryptString: (value) => value.toString("utf8").replace(/^encrypted:/u, ""),
};

describe("AI credential vault", () => {
  it("stores only encrypted bytes, retrieves the key, replaces it, and disconnects", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-ai-vault-"));
    const vault = new ElectronCredentialVault(directory, safeStorage);
    expect(await vault.read("openai")).toBeNull();

    await vault.write("openai", SECRET);
    const envelope = await readFile(join(directory, "credentials", "ai-provider.json"), "utf8");
    expect(envelope).not.toContain(SECRET);
    expect(await vault.read("openai")).toBe(SECRET);

    await vault.write("openai", `${SECRET}-replacement`);
    expect(await vault.read("openai")).toBe(`${SECRET}-replacement`);
    await vault.delete("openai");
    expect(await vault.read("openai")).toBeNull();
  });

  it("fails closed when operating-system encryption is unavailable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "laserx-ai-vault-"));
    const vault = new ElectronCredentialVault(directory, {
      ...safeStorage,
      isEncryptionAvailable: () => false,
    });
    await expect(vault.write("openai", SECRET)).rejects.toThrow(/unavailable/u);
  });
});
