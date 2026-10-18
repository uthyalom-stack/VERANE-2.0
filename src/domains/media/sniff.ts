import { AppError } from "@/lib/errors";

export type Sniffed = { kind: "image" | "video" | "model3d"; mime: string; ext: string; width?: number; height?: number };
export const LIMITS = { image: 15 * 1024 * 1024, video: 100 * 1024 * 1024, model3d: 50 * 1024 * 1024 } as const;
const ascii = (b: Uint8Array, s: number, e: number) => String.fromCharCode(...b.slice(s, e));

/** Decide the type from the file's BYTES. The filename and the browser-supplied Content-Type are ignored. SVG is rejected (script-capable). */
export function sniff(b: Uint8Array): Sniffed | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", mime: "image/jpeg", ext: "jpg", ...jpegSize(b) };
  if (ascii(b, 1, 4) === "PNG" && b[0] === 0x89) return { kind: "image", mime: "image/png", ext: "png", width: dv(b).getUint32(16), height: dv(b).getUint32(20) };
  if (ascii(b, 0, 4) === "GIF8") return { kind: "image", mime: "image/gif", ext: "gif", width: dv(b).getUint16(6, true), height: dv(b).getUint16(8, true) };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { kind: "image", mime: "image/webp", ext: "webp", ...webpSize(b) };
  if (ascii(b, 4, 8) === "ftyp") { const brand = ascii(b, 8, 12); if (brand === "avif" || brand === "avis") return { kind: "image", mime: "image/avif", ext: "avif" }; if (["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].includes(brand)) return { kind: "video", mime: "video/mp4", ext: "mp4" }; }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", mime: "video/webm", ext: "webm" };
  if (ascii(b, 0, 4) === "glTF") return { kind: "model3d", mime: "model/gltf-binary", ext: "glb" };
  return null;
}
const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
function jpegSize(b: Uint8Array): { width?: number; height?: number } {
  let i = 2; const v = dv(b);
  while (i + 9 < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]!; if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { height: v.getUint16(i + 5), width: v.getUint16(i + 7) }; i += 2 + v.getUint16(i + 2); }
  return {};
}
function webpSize(b: Uint8Array): { width?: number; height?: number } {
  const t = ascii(b, 12, 16), v = dv(b);
  if (t === "VP8X") return { width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
  if (t === "VP8 ") return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
  if (t === "VP8L") { const n = v.getUint32(21, true); return { width: (n & 0x3fff) + 1, height: ((n >> 14) & 0x3fff) + 1 }; }
  return {};
}

export function validateUpload(bytes: Uint8Array, size: number): Sniffed {
  const s = sniff(bytes);
  if (!s) throw new AppError("VALIDATION", "Unsupported file type. Use JPEG, PNG, WebP, AVIF, GIF, MP4, WebM or GLB.");
  if (size <= 0 || size > LIMITS[s.kind]) throw new AppError("VALIDATION", `File too large (max ${Math.round(LIMITS[s.kind] / 1048576)} MB for ${s.kind}s)`);
  return s;
}
