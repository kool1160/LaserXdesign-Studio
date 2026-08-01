import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const size = 512;
const pixels = Buffer.alloc(size * size * 4);

function roundedRectContains(x, y, inset, radius) {
  const nearX = Math.max(inset + radius, Math.min(x, size - inset - radius));
  const nearY = Math.max(inset + radius, Math.min(y, size - inset - radius));
  return Math.hypot(x - nearX, y - nearY) <= radius;
}

function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const ratio = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + ratio * dx), y - (ay + ratio * dy));
}

function blend(index, red, green, blue, alpha = 255) {
  const sourceAlpha = alpha / 255;
  const targetAlpha = pixels[index + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outputAlpha === 0) return;
  pixels[index] = Math.round((red * sourceAlpha + pixels[index] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 1] = Math.round((green * sourceAlpha + pixels[index + 1] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 2] = Math.round((blue * sourceAlpha + pixels[index + 2] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 3] = Math.round(outputAlpha * 255);
}

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const index = (y * size + x) * 4;
    if (!roundedRectContains(x, y, 20, 112)) continue;
    const border = !roundedRectContains(x, y, 34, 98);
    const mix = (x + y) / (size * 2);
    blend(
      index,
      border ? 57 : Math.round(24 - mix * 13),
      border ? 122 : Math.round(49 - mix * 29),
      border ? 120 : Math.round(57 - mix * 32),
    );

    if (segmentDistance(x, y, 120, 112, 392, 400) <= 29) {
      blend(index, Math.round(139 - mix * 85), Math.round(232 - mix * 27), Math.round(213 - mix * 28));
    }
    if (segmentDistance(x, y, 392, 112, 240, 272) <= 29) {
      blend(index, 244, 187, 100);
    }
    if (segmentDistance(x, y, 240, 272, 128, 400) <= 29) {
      blend(index, 83, 205, 185);
    }
    if (segmentDistance(x, y, 72, 272, 164, 272) <= 8) {
      blend(index, 244, 187, 100);
    }
    const focusDistance = Math.hypot(x - 240, y - 272);
    if (focusDistance <= 38) blend(index, 244, 187, 100);
    if (focusDistance <= 24) blend(index, 255, 246, 223);
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

const rows = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y += 1) {
  const rowStart = y * (size * 4 + 1);
  rows[rowStart] = 0;
  pixels.copy(rows, rowStart + 1, y * size * 4, (y + 1) * size * 4);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(rows, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "..", "public", "laserx-icon.png");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, png);
