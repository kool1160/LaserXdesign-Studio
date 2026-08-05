import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { validatePngStructure } from "../src/capture.js";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WIDTH = 4;
const HEIGHT = 2;

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function ihdr(): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(WIDTH, 0);
  data.writeUInt32BE(HEIGHT, 4);
  data[8] = 8;
  data[9] = 6;
  return chunk("IHDR", data);
}

function idat(): Buffer {
  return chunk("IDAT", deflateSync(Buffer.alloc(HEIGHT * (1 + WIDTH * 4))));
}

function png(...chunks: Buffer[]): Uint8Array {
  return new Uint8Array(Buffer.concat([SIGNATURE, ...chunks]));
}

const text = (): Buffer => chunk("tEXt", Buffer.from("Comment\0hello", "ascii"));
const iend = (): Buffer => chunk("IEND", Buffer.alloc(0));

describe("validatePngStructure", () => {
  it("accepts a well-formed PNG", () => {
    expect(validatePngStructure(png(ihdr(), idat(), iend()))).toBeNull();
  });

  it("accepts multiple consecutive IDAT chunks", () => {
    // Real encoders split large image data across several IDAT chunks; that
    // is valid precisely because they are consecutive.
    expect(validatePngStructure(png(ihdr(), idat(), idat(), idat(), iend()))).toBeNull();
  });

  it("accepts an ancillary chunk before the image data", () => {
    expect(validatePngStructure(png(ihdr(), text(), idat(), iend()))).toBeNull();
  });

  it("rejects non-consecutive IDAT chunks separated by an ancillary chunk", () => {
    // Every chunk here is individually well-framed and CRC-correct; only the
    // ordering rule makes the stream malformed.
    expect(validatePngStructure(png(ihdr(), idat(), text(), idat(), iend()))).toBe(
      "non-consecutive-idat",
    );
  });

  it("rejects a bad signature", () => {
    const bytes = png(ihdr(), idat(), iend());
    bytes[0] = 0;
    expect(validatePngStructure(bytes)).toBe("bad-signature");
  });

  it("rejects a corrupt chunk CRC", () => {
    const bytes = png(ihdr(), idat(), iend());
    const idatDataStart = 8 + 25 + 8;
    bytes[idatDataStart] = (bytes[idatDataStart] ?? 0) ^ 0xff;
    expect(validatePngStructure(bytes)).toBe("bad-chunk-crc");
  });

  it("rejects an IHDR whose length is not exactly 13 bytes", () => {
    expect(validatePngStructure(png(chunk("IHDR", Buffer.alloc(20)), idat(), iend()))).toBe(
      "bad-ihdr-length",
    );
  });

  it("rejects a duplicate IHDR", () => {
    expect(validatePngStructure(png(ihdr(), ihdr(), idat(), iend()))).toBe("duplicate-ihdr");
  });

  it("rejects a first chunk that is not IHDR", () => {
    expect(validatePngStructure(png(text(), ihdr(), idat(), iend()))).toBe("missing-ihdr");
  });

  it("rejects a stream with no IDAT", () => {
    expect(validatePngStructure(png(ihdr(), iend()))).toBe("missing-idat");
  });

  it("rejects an IEND carrying data", () => {
    expect(
      validatePngStructure(png(ihdr(), idat(), chunk("IEND", Buffer.from("x", "ascii")))),
    ).toBe("bad-iend-length");
  });

  it("rejects bytes after IEND", () => {
    const bytes = new Uint8Array(
      Buffer.concat([Buffer.from(png(ihdr(), idat(), iend())), Buffer.alloc(4)]),
    );
    expect(validatePngStructure(bytes)).toBe("trailing-bytes");
  });

  it("rejects a truncated stream", () => {
    const full = Buffer.from(png(ihdr(), idat(), iend()));
    expect(validatePngStructure(new Uint8Array(full.subarray(0, full.length - 6)))).toBe(
      "truncated",
    );
  });

  it("rejects a stream with no IEND", () => {
    expect(validatePngStructure(png(ihdr(), idat()))).toBe("missing-iend");
  });
});
