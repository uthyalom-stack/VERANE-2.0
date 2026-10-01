"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/infrastructure/database/client";
import { IdentityRepository } from "@/domains/identity/identity-repository";
import { AuditService } from "@/domains/audit/audit-service";
import { verifyPassword } from "@/lib/auth/password";
import { getSessionCookieConfig } from "@/lib/auth/cookies";

export interface AuthState {
  error?: string;
}

// Pre-computed PBKDF2 hash for "dummy-password" (100k iterations, salt: 00000000000000000000000000000000)
const DUMMY_HASH = "00000000000000000000000000000000:72b5c777e4e1a0ad10a6cb7c050a4d53896dfb2be1ff110be1494ae4a8e0f6c2";
const GENERIC_AUTH_ERROR = "Invalid email or password.";

export async function loginAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email")?.toString()?.trim() || "";
  const password = formData.get("password")?.toString() || "";

  if (!email || !password) {
    return { error: GENERIC_AUTH_ERROR };
  }

  const identityRepo = new IdentityRepository(db);
  const auditService = new AuditService(db);

  const user = await identityRepo.findUserByEmail(email);

  // Constant-time execution: always verify password against user's hash or dummy hash
  const hashToVerify = user?.passwordHash ?? DUMMY_HASH;
  const isPasswordValid = await verifyPassword(password, hashToVerify);

  // Single generic check preventing account enumeration & timing leaks
  if (!user || !isPasswordValid || !user.isActive) {
    return { error: GENERIC_AUTH_ERROR };
  }

  const session = await identityRepo.createSession(user.id);
  const cookieConfig = getSessionCookieConfig();

  const cookieStore = await cookies();
  cookieStore.set(cookieConfig.name, session.id, cookieConfig.options);

  const adminProfile = await identityRepo.getAdminProfileByUserId(user.id);

  if (adminProfile) {
    await auditService.log({
      actorUserId: user.id,
      action: "admin.login",
      entityType: "user",
      entityId: user.id,
    });
    redirect("/admin");
  } else {
    redirect("/account");
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieConfig().name)?.value;

  if (sessionToken) {
    const identityRepo = new IdentityRepository(db);
    const auditService = new AuditService(db);

    const session = await identityRepo.findSessionById(sessionToken);
    if (session) {
      await identityRepo.revokeSession(sessionToken);
      const adminProfile = await identityRepo.getAdminProfileByUserId(session.userId);
      if (adminProfile) {
        await auditService.log({
          actorUserId: session.userId,
          action: "admin.logout",
          entityType: "user",
          entityId: session.userId,
        });
      }
    }
  }

  cookieStore.delete(getSessionCookieConfig().name);
  redirect("/login");
}
