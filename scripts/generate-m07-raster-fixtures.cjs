const { createHash } = require("node:crypto");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { deflateSync } = require("node:zlib");

const { app, nativeImage } = require("electron");

const root = resolve(__dirname, "..");
const outputDirectory = resolve(root, "fixtures", "images", "m07");

const crcTable = Array.from({ length: 256 }, (_unused, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) {
    current = (current & 1) === 1
      ? 0xedb88320 ^ (current >>> 1)
      : current >>> 1;
  }
  return current >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  Buffer.from(data).copy(output, 8);
  output.writeUInt32BE(
    crc32(Buffer.concat([typeBytes, Buffer.from(data)])),
    8 + data.length,
  );
  return output;
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0;
    Buffer.from(rgba.subarray(y * width * 4, (y + 1) * width * 4)).copy(
      scanlines,
      rowOffset + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function raster(width, height, sample) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = sample(x, y);
      const offset = (y * width + x) * 4;
      rgba[offset] = red;
      rgba[offset + 1] = green;
      rgba[offset + 2] = blue;
      rgba[offset + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function inRect(x, y, left, top, right, bottom) {
  return x >= left && x < right && y >= top && y < bottom;
}

function cleanLogo() {
  return raster(192, 128, (x, y) => {
    const foreground =
      inRect(x, y, 34, 22, 58, 106) ||
      inRect(x, y, 58, 82, 146, 106) ||
      inRect(x, y, 112, 22, 136, 70) ||
      inRect(x, y, 88, 46, 160, 70);
    return foreground ? [24, 29, 34] : [246, 244, 238];
  });
}

function noisyPhoto() {
  return raster(320, 240, (x, y) => {
    const deterministicNoise = ((x * 73 + y * 151 + x * y * 13) % 43) - 21;
    const logo =
      inRect(x, y, 70, 50, 105, 190) ||
      inRect(x, y, 215, 50, 250, 190) ||
      inRect(x, y, 105, 102, 215, 138);
    const edgeShadow =
      inRect(x, y, 67, 47, 108, 193) ||
      inRect(x, y, 212, 47, 253, 193) ||
      inRect(x, y, 102, 99, 218, 141);
    const isolatedDust = !edgeShadow && (x * 97 + y * 53) % 4093 === 0;
    const lightFalloff = Math.round(18 * y / 239 + 12 * x / 319);
    const value = logo
      ? 52 + Math.round(deterministicNoise / 3) + Math.round(12 * x / 319)
      : edgeShadow
        ? 126 + Math.round(deterministicNoise / 4)
        : isolatedDust
          ? 72
          : 198 + lightFalloff + deterministicNoise;
    const clamped = Math.max(0, Math.min(255, value));
    return [clamped, clamped, clamped];
  });
}

function rectangleCoverage(x, y, left, top, right, bottom) {
  let covered = 0;
  for (let sampleY = 0; sampleY < 4; sampleY += 1) {
    for (let sampleX = 0; sampleX < 4; sampleX += 1) {
      const pointX = x + (sampleX + 0.5) / 4;
      const pointY = y + (sampleY + 0.5) / 4;
      if (
        pointX >= left &&
        pointX < right &&
        pointY >= top &&
        pointY < bottom
      ) {
        covered += 1;
      }
    }
  }
  return covered / 16;
}

function antiAliasedText() {
  return raster(256, 128, (x, y) => {
    const coverage = Math.max(
      rectangleCoverage(x, y, 42.25, 22.5, 66.75, 106.25),
      rectangleCoverage(x, y, 129.5, 22.5, 154.25, 106.25),
      rectangleCoverage(x, y, 66.5, 52.25, 130, 76.75),
      rectangleCoverage(x, y, 174.25, 22.5, 198.75, 106.25),
    );
    const value = Math.round(248 - coverage * 224);
    return [value, value, value];
  });
}

function highResolutionLogo() {
  return raster(2560, 1800, (x, y) => {
    const foreground =
      inRect(x, y, 430, 280, 760, 1520) ||
      inRect(x, y, 1800, 280, 2130, 1520) ||
      inRect(x, y, 760, 735, 1800, 1065);
    return foreground ? [20, 24, 28] : [248, 247, 242];
  });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeFixture(name, bytes) {
  const path = resolve(outputDirectory, name);
  writeFileSync(path, bytes);
  return {
    name,
    bytes: bytes.length,
    sha256: sha256(readFileSync(path)),
  };
}

app.whenReady().then(() => {
  mkdirSync(outputDirectory, { recursive: true });
  const clean = cleanLogo();
  const cleanPng = encodePng(clean.width, clean.height, clean.rgba);
  const cleanJpeg = nativeImage.createFromBuffer(cleanPng).toJPEG(92);
  const assets = [
    writeFixture("clean-logo.png", cleanPng),
    writeFixture("clean-logo.jpg", cleanJpeg),
    writeFixture(
      "noisy-photo.png",
      encodePng(...Object.values(noisyPhoto())),
    ),
    writeFixture(
      "anti-aliased-text.png",
      encodePng(...Object.values(antiAliasedText())),
    ),
    writeFixture(
      "high-resolution-logo.png",
      encodePng(...Object.values(highResolutionLogo())),
    ),
  ];
  process.stdout.write(`${JSON.stringify(assets, null, 2)}\n`);
  app.quit();
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  app.exit(1);
});
