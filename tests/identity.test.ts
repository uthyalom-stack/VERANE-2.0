import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseConnection } from "../src/infrastructure/database/client";
import { IdentityRepository } from "../src/domains/identity/identity-repository";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { sessions } from "../src/infrastructure/database/schema";

interface SqliteSessionClient {
  session: {
    client: {
      execute: (sql: string) => Promise<unknown>;
    };
  };
}

describe("Identity & Authentication", () => {
  const db = createDatabaseConnection({ url: "file::memory:" });
  const identityRepo = new IdentityRepository(db);

  beforeEach(async () => {
    // Setup schema tables in memory
    const client = (db as unknown as SqliteSessionClient).session.client;
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS customer_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS admin_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
    `);
  });

  it("should correctly hash and verify passwords using Web Crypto PBKDF2", async () => {
    const password = "SuperSecretPassword123!";
    const hashed = await hashPassword(password);

    expect(hashed).not.toEqual(password);
    expect(hashed.split(":").length).toBe(2);

    const isValid = await verifyPassword(password, hashed);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("WrongPassword", hashed);
    expect(isInvalid).toBe(false);
  });

  it("should create user and handle session lifecycle (creation, retrieval, active check, revocation)", async () => {
    const passwordHash = await hashPassword("Secret123!");
    const userId = "user_test_1";

    const user = await identityRepo.createUser({
      id: userId,
      email: "test@verane.com",
      name: "Test User",
      passwordHash,
      isActive: true,
    });

    expect(user.id).toBe(userId);
    expect(user.email).toBe("test@verane.com");

    // Session creation
    const session = await identityRepo.createSession(userId, 7);
    expect(session.userId).toBe(userId);
    expect(session.revokedAt).toBeNull();

    // Session active check
    const activeSession = await identityRepo.findActiveSessionById(session.id);
    expect(activeSession).toBeDefined();
    expect(activeSession?.id).toBe(session.id);

    // Session revocation
    await identityRepo.revokeSession(session.id);
    const revokedSession = await identityRepo.findActiveSessionById(session.id);
    expect(revokedSession).toBeUndefined();
  });

  it("should deny active session lookup for inactive users or expired sessions", async () => {
    const passwordHash = await hashPassword("Secret123!");
    const userId = "user_inactive";

    await identityRepo.createUser({
      id: userId,
      email: "inactive@verane.com",
      name: "Inactive User",
      passwordHash,
      isActive: false,
    });

    // Create session with past expiry
    const sessionId = "expired_session";
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() - 10000),
      createdAt: new Date(),
      lastUsedAt: new Date(),
    });

    const activeSession = await identityRepo.findActiveSessionById(sessionId);
    expect(activeSession).toBeUndefined();
  });
});
