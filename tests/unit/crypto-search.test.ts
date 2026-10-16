import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, hmacHex, safeEqual } from "@/lib/crypto";
import { toFtsQuery } from "@/domains/search";
import { slugify } from "@/lib/slug";
import { getEnv } from "@/lib/env";

describe("crypto", () => {
  it("hashes and verifies passwords; wrong password fails", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("pbkdf2-sha256$100000$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("nope", h)).toBe(false);
  });
  it("hmac sha512 is deterministic and safeEqual is exact", async () => {
    const a = await hmacHex("SHA-512", "k", "body"); expect(a).toBe(await hmacHex("SHA-512", "k", "body"));
    expect(safeEqual(a, a)).toBe(true); expect(safeEqual(a, a.slice(0, -1) + "0")).toBe(a.endsWith("0"));
  });
});
describe("search query sanitising", () => {
  it("strips FTS operators and quotes tokens", () => {
    expect(toFtsQuery('black" OR *dress')).toBe('"black"* AND "or"* AND "dress"*');
    expect(toFtsQuery("!!")).toBeNull();
  });
});
describe("slug + env", () => {
  it("slugifies", () => expect(slugify("VÉRANE Évening & Gown")).toBe("verane-evening-and-gown"));
  it("production fails closed without live integrations", () => {
    expect(() => getEnv({ SESSION_SECRET: "x".repeat(40), TOKEN_PEPPER: "y".repeat(40), APP_ENV: "production", APP_URL: "https://example.com", DATABASE_URL: "libsql://x" })).toThrow(/PAYSTACK/);
  });
});
