const path = require("node:path");

const packageVersion = process.env.LASERX_PACKAGE_VERSION;
const outputDirectory = process.env.LASERX_PACKAGE_OUTPUT ?? "dist-packaged";
const requireCodeSigning = process.env.LASERX_REQUIRE_CODE_SIGNING === "1";

module.exports = {
  appId: "studio.laserx.desktop",
  productName: "LaserX Design Studio",
  artifactName: "LaserX-Design-Studio-${version}-${arch}.${ext}",
  asar: true,
  compression: "maximum",
  copyright: "Copyright © 2026 LaserX Design Studio",
  ...(packageVersion === undefined
    ? {}
    : { extraMetadata: { version: packageVersion } }),
  directories: {
    buildResources: "build-resources",
    output: outputDirectory,
  },
  files: ["dist/**/*", "package.json"],
  win: {
    executableName: "LaserX Design Studio",
    icon: "public/laserx-icon.png",
    forceCodeSigning: requireCodeSigning,
    signtoolOptions: {
      signingHashAlgorithms: ["sha256"],
      rfc3161TimeStampServer: "http://timestamp.digicert.com",
    },
    target: [{ target: "nsis", arch: ["x64"] }],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: false,
    createStartMenuShortcut: true,
    createDesktopShortcut: false,
    shortcutName: "LaserX Design Studio",
    uninstallDisplayName: "LaserX Design Studio",
    runAfterFinish: true,
    include: path.join(__dirname, "build-resources", "installer.nsh"),
    artifactName: "LaserX-Design-Studio-Setup-${version}-${arch}.${ext}",
  },
};
