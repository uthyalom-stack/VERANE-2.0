import { describe, expect, it } from "vitest";
import { isPubliclyVisibleProduct } from "@/domains/catalog/public";

describe("public product visibility", () => {
  const now = new Date("2026-10-17T12:00:00.000Z");

  it("keeps published products visible", () => {
    expect(isPubliclyVisibleProduct({ status: "published", publishAt: new Date("2027-01-01T00:00:00.000Z") }, now)).toBe(true);
  });

  it("keeps scheduled products hidden until their publication time", () => {
    expect(isPubliclyVisibleProduct({ status: "scheduled", publishAt: new Date("2026-10-17T12:00:01.000Z") }, now)).toBe(false);
    expect(isPubliclyVisibleProduct({ status: "scheduled", publishAt: null }, now)).toBe(false);
  });

  it("makes scheduled products visible once their publication time arrives", () => {
    expect(isPubliclyVisibleProduct({ status: "scheduled", publishAt: new Date("2026-10-17T12:00:00.000Z") }, now)).toBe(true);
    expect(isPubliclyVisibleProduct({ status: "scheduled", publishAt: new Date("2026-10-17T11:59:59.000Z") }, now)).toBe(true);
  });

  it("never exposes drafts or archived products", () => {
    expect(isPubliclyVisibleProduct({ status: "draft", publishAt: null }, now)).toBe(false);
    expect(isPubliclyVisibleProduct({ status: "archived", publishAt: null }, now)).toBe(false);
  });
});
