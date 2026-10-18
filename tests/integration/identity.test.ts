import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeTestDb } from "../helpers";
import { login, registerCustomer, requestPasswordReset, resetPassword, revokeSession, validateSession, verifyEmail } from "@/domains/identity";

const PEPPER = "p".repeat(40);
let ctx: Awaited<ReturnType<typeof makeTestDb>>;
beforeAll(async () => { ctx = await makeTestDb(); });
afterAll(() => ctx.cleanup());

describe("identity", () => {
  it("registers, verifies email once, logs in, validates and revokes a session", async () => {
    const { verifyToken } = await registerCustomer(ctx.db, { email: "Ada@Example.com", password: "a-long-password", firstName: "Ada", lastName: "L" }, PEPPER);
    await verifyEmail(ctx.db, verifyToken, PEPPER);
    await expect(verifyEmail(ctx.db, verifyToken, PEPPER)).rejects.toThrow(); // single use
    const { token } = await login(ctx.db, { email: "ada@example.com", password: "a-long-password" }, PEPPER, { ip: "1.1.1.1" });
    expect((await validateSession(ctx.db, token, PEPPER))?.user.email).toBe("ada@example.com");
    await revokeSession(ctx.db, token, PEPPER);
    expect(await validateSession(ctx.db, token, PEPPER)).toBeNull();
  });
  it("rejects wrong passwords generically, then locks after repeated failures", async () => {
    for (let i = 0; i < 5; i++) await expect(login(ctx.db, { email: "ada@example.com", password: "wrong-password" }, PEPPER, { ip: `9.9.9.${i}` })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(login(ctx.db, { email: "ada@example.com", password: "a-long-password" }, PEPPER, { ip: "8.8.8.8" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
  it("password reset is single-use and invalidates sessions", async () => {
    const { registerCustomer: reg } = await import("@/domains/identity");
    await reg(ctx.db, { email: "bo@example.com", password: "another-long-pass", firstName: "Bo", lastName: "K" }, PEPPER);
    const { token: sess } = await login(ctx.db, { email: "bo@example.com", password: "another-long-pass" }, PEPPER, { ip: "2.2.2.2" });
    const r = (await requestPasswordReset(ctx.db, "bo@example.com", PEPPER))!;
    await resetPassword(ctx.db, r.token, "brand-new-password", PEPPER);
    await expect(resetPassword(ctx.db, r.token, "yet-another-pass1", PEPPER)).rejects.toThrow();
    expect(await validateSession(ctx.db, sess, PEPPER)).toBeNull();
    await login(ctx.db, { email: "bo@example.com", password: "brand-new-password" }, PEPPER, { ip: "2.2.2.3" });
    expect(await requestPasswordReset(ctx.db, "ghost@example.com", PEPPER)).toBeNull();
  });
});
