export interface PngInspectionValid {
  valid: true;
  widthPx: number;
  heightPx: number;
  byteLength: number;
  sha256: string;
}

export interface PngInspectionInvalid {
  valid: false;
  reason: string;
  byteLength: number;
}

export type PngInspection = PngInspectionValid | PngInspectionInvalid;

export function inspectPng(bytes: Uint8Array): PngInspection;
export function pngBytesFromDataUrl(dataUrl: string): Uint8Array;
