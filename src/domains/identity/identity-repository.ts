import { Database } from "@/infrastructure/database/client";
import { users, sessions, customerProfiles, adminProfiles, User, Session, NewUser } from "@/infrastructure/database/schema";
import { eq, and, gt } from "drizzle-orm";

export class IdentityRepository {
  constructor(private db: Database) {}

  async findUserByEmail(email: string): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).get();
  }

  async findUserById(id: string): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.id, id)).get();
  }

  async createUser(data: NewUser): Promise<User> {
    await this.db.insert(users).values({
      ...data,
      email: data.email.toLowerCase().trim(),
    });
    const created = await this.findUserById(data.id);
    if (!created) throw new Error("Failed to create user");
    return created;
  }

  async createCustomerProfile(userId: string): Promise<void> {
    const id = crypto.randomUUID();
    await this.db.insert(customerProfiles).values({ id, userId });
  }

  async createAdminProfile(userId: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.insert(adminProfiles).values({ id, userId });
    return id;
  }

  async getCustomerProfileByUserId(userId: string) {
    return this.db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).get();
  }

  async getAdminProfileByUserId(userId: string) {
    return this.db.select().from(adminProfiles).where(eq(adminProfiles.userId, userId)).get();
  }

  async createSession(userId: string, durationInDays = 7): Promise<Session> {
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + durationInDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    await this.db.insert(sessions).values({
      id,
      userId,
      expiresAt,
      createdAt: now,
      lastUsedAt: now,
    });

    const created = await this.findSessionById(id);
    if (!created) throw new Error("Failed to create session");
    return created;
  }

  async findSessionById(sessionId: string): Promise<Session | undefined> {
    return this.db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  }

  async findActiveSessionById(sessionId: string): Promise<Session | undefined> {
    const now = new Date();
    const result = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
      .get();

    if (!result || result.revokedAt !== null) {
      return undefined;
    }

    return result;
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }
}
