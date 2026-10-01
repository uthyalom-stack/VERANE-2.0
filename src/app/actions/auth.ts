"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/infrastructure/database/client";
import { IdentityRepository } from "@/domains/identity/identity-repository";
import { AuditService } from "@/domains/audit/audit-service";
import { verifyPassword } from "@/lib/auth/password";
import { getSessionCookieConfig } from "@/lib/auth/cookies";
import { ValidationError, UnauthorizedError } from "@/lib/errors";

export async function loginAction(formData: FormData) {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    throw new ValidationError("Email and password are required.");
  }

  const identityRepo = new IdentityRepository(db);
  const auditService = new AuditService(db);

  const user = await identityRepo.findUserByEmail(email);
  if (!user) {
    throw new UnauthorizedError("Invalid credentials.");
  }

  if (!user.isActive) {
    throw new UnauthorizedError("Account is inactive.");
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedError("Invalid credentials.");
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
