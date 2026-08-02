import assert from "node:assert/strict";

import { validateReleaseEnvironment } from "./validate-controlled-beta-release.mjs";

const validEnvironment = {
  GH_TOKEN: "test-token-never-sent",
  RELEASE_CONFIRMATION: "PUBLISH REVIEWED BETA",
  RELEASE_TAG: "v0.13.0-beta.1",
  LASERX_EXPECTED_SIGNER_THUMBPRINT: "0123456789abcdef0123456789abcdef01234567",
};

assert.throws(
  () => validateReleaseEnvironment({ ...validEnvironment, GH_TOKEN: "" }, "0.13.0-beta.1"),
  /GH_TOKEN is required/u,
);
assert.throws(
  () => validateReleaseEnvironment({ ...validEnvironment, LASERX_EXPECTED_SIGNER_THUMBPRINT: "1234" }, "0.13.0-beta.1"),
  /complete 40-character/u,
);
assert.throws(
  () => validateReleaseEnvironment({ ...validEnvironment, RELEASE_TAG: "v0.13.0-beta.2" }, "0.13.0-beta.1"),
  /does not match package version/u,
);
assert.deepEqual(
  validateReleaseEnvironment(validEnvironment, "0.13.0-beta.1"),
  {
    githubToken: "test-token-never-sent",
    releaseTag: "v0.13.0-beta.1",
    signerThumbprint: "0123456789ABCDEF0123456789ABCDEF01234567",
  },
);

console.log("Controlled beta release gate regression tests passed: GitHub token, exact tag, confirmation, and signer identity are required before external commands.");
