import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/http/safe-next";
import { sniff, validateUpload, LIMITS } from "@/domains/media/sniff";

const bytes = (...n: number[]) => Uint8Array.from([...n, ...new Array(Math.max(0, 32 - n.length)).fill(0)]);
const png = () => { const b = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52); new DataView(b.buffer).setUint32(16, 800); new DataView(b.buffer).setUint32(20, 1000); return b; };

describe("open-redirect guard", () => {
  it("allows only same-site relative paths", () => {
    expect(safeNext("/account/orders")).toBe("/account/orders");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", undefined, 42]) expect(safeNext(bad as never, "/x")).toBe("/x");
  });
});
describe("media sniffing (content, not filename)", () => {
  it("identifies PNG with dimensions, JPEG, GIF, WebM, GLB, MP4", () => {
    expect(sniff(png())).toMatchObject({ kind: "image", mime: "image/png", width: 800, height: 1000 });
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(sniff(Uint8Array.from([..."GIF89a".padEnd(16, "\0")].map((c) => c.charCodeAt(0))))?.mime).toBe("image/gif");
    expect(sniff(bytes(0x1a, 0x45, 0xdf, 0xa3))?.mime).toBe("video/webm");
    expect(sniff(Uint8Array.from([..."glTF"].map((c) => c.charCodeAt(0)).concat(new Array(28).fill(0))))?.mime).toBe("model/gltf-binary");
    const mp4 = new Uint8Array(32); mp4.set([..."ftypisom"].map((c) => c.charCodeAt(0)), 4); expect(sniff(mp4)?.mime).toBe("video/mp4");
  });
  it("rejects SVG, HTML, scripts and executables even if renamed .jpg", () => {
    const enc = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0))).slice(0, 64);
    for (const s of ["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "<html><script>alert(1)</script></html>", "MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff"]) expect(() => validateUpload(enc(s.padEnd(40, " ")), 40)).toThrow(/Unsupported/);
  });
  it("enforces per-kind size limits", () => {
    expect(() => validateUpload(png(), LIMITS.image + 1)).toThrow(/too large/);
    expect(() => validateUpload(png(), 0)).toThrow();
    expect(validateUpload(png(), 1024).kind).toBe("image");
  });
});
