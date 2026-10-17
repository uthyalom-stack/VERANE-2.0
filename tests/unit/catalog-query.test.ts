import { describe, expect, it } from "vitest";
import { shopQuery } from "@/domains/catalog/schemas";

describe("shop query filters", () => {
  it("accepts the discounted rail's sale filter", () => {
    expect(shopQuery.parse({ sale: true })).toMatchObject({ sale: true });
    expect(shopQuery.parse({ sale: "true" })).toMatchObject({ sale: true });
  });

  it("does not treat the string false as a true filter", () => {
    expect(shopQuery.parse({ sale: "false", featured: "false" })).toMatchObject({ sale: false, featured: false });
  });

  it("keeps the existing sort and pagination defaults", () => {
    expect(shopQuery.parse({})).toMatchObject({ sort: "featured", page: 1, pageSize: 24 });
  });
});
