import { describe, it, expect } from "vitest";
import { parseServerEnv } from "../src/config/env";

describe("Environment Validation", () => {
  it("should parse development environment with default session secret fallback", () => {
    const env = parseServerEnv({
      NODE_ENV: "development",
    });

    expect(env.NODE_ENV).toBe("development");
    expect(env.SESSION_SECRET).toBe("development-only-verane-session-secret-32chars");
  });

  it("should succeed in production when SESSION_SECRET is provided and valid", () => {
    const env = parseServerEnv({
      NODE_ENV: "production",
      SESSION_SECRET: "valid-production-secret-min-16-chars",
    });

    expect(env.NODE_ENV).toBe("production");
    expect(env.SESSION_SECRET).toBe("valid-production-secret-min-16-chars");
  });

  it("should fail in production when SESSION_SECRET is missing", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
      })
    ).toThrow(/SESSION_SECRET is required in production/);
  });

  it("should fail in production when SESSION_SECRET is shorter than 16 characters", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
        SESSION_SECRET: "short-secret",
      })
    ).toThrow(/at least 16 characters/);
  });
});
