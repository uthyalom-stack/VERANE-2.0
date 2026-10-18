import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, hmacHex, safeEqual } from "@/lib/crypto";
import { slugify } from "@/lib/slug";
describe("crypto", () => {
  it("hashes and verifies passwords", async () => { const h = await hashPassword("correct horse battery"); expect(h.startsWith("pbkdf2-sha256$100000$")).toBe(true); expect(await verifyPassword("correct horse battery", h)).toBe(true); expect(await verifyPassword("nope", h)).toBe(false); });
  it("hmac + safeEqual", async () => { const a = await hmacHex("SHA-512", "k", "body"); expect(a).toBe(await hmacHex("SHA-512", "k", "body")); expect(safeEqual(a, a)).toBe(true); expect(safeEqual(a, a + "0")).toBe(false); });
  it("slugify", () => expect(slugify("VÉRANE Évening & Gown")).toBe("verane-evening-and-gown"));
});
