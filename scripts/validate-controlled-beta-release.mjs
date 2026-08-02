import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");

export function validateReleaseEnvironment(environment, packageVersion) {
  const githubToken = environment.GH_TOKEN?.trim();
  if (!githubToken) {
    throw new Error("GH_TOKEN is required before the release gate can query GitHub.");
  }
  if (environment.RELEASE_CONFIRMATION !== "PUBLISH REVIEWED BETA") {
    throw new Error("Release confirmation did not match.");
  }
  const expectedTag = `v${packageVersion}`;
  if (environment.RELEASE_TAG !== expectedTag) {
    throw new Error(`Tag ${String(environment.RELEASE_TAG)} does not match package version ${packageVersion}.`);
  }
  const signerThumbprint = environment.LASERX_EXPECTED_SIGNER_THUMBPRINT
    ?.replace(/\s/gu, "")
    .toUpperCase();
  if (!/^[0-9A-F]{40}$/u.test(signerThumbprint ?? "")) {
    throw new Error("LASERX_EXPECTED_SIGNER_THUMBPRINT must be a complete 40-character SHA-1 certificate thumbprint.");
  }
  return {
    githubToken,
    releaseTag: expectedTag,
    signerThumbprint,
  };
}

function command(commandName, argumentsList, options = {}) {
  return execFileSync(commandName, argumentsList, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

export function validateExactTag(releaseTag) {
  command("git", ["rev-parse", "--verify", `refs/tags/${releaseTag}^{commit}`]);
  const tagCommit = command("git", ["rev-list", "-n", "1", releaseTag]);
  const headCommit = command("git", ["rev-parse", "HEAD"]);
  if (tagCommit !== headCommit) {
    throw new Error("Checked-out head does not match the requested tag.");
  }
  return headCommit;
}

export function assertReleaseDoesNotExist(releaseTag, githubToken) {
  const releases = JSON.parse(
    command("gh", ["release", "list", "--limit", "100", "--json", "tagName"], {
      env: { ...process.env, GH_TOKEN: githubToken },
    }),
  );
  if (releases.some((release) => release.tagName === releaseTag)) {
    throw new Error(`A GitHub release already exists for ${releaseTag}.`);
  }
}

async function main() {
  const rootPackage = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const validated = validateReleaseEnvironment(process.env, rootPackage.version);
  const sourceCommit = validateExactTag(validated.releaseTag);
  assertReleaseDoesNotExist(validated.releaseTag, validated.githubToken);
  console.log(`Controlled release gate passed for ${validated.releaseTag} at ${sourceCommit} with reviewed signer ${validated.signerThumbprint}.`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
