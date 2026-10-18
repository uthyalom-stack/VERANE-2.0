export type ErrorCode =
  | "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT"
  | "OUT_OF_STOCK" | "RATE_LIMITED" | "PROVIDER" | "CONFIG" | "INTERNAL";

export class AppError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "AppError";
  }
}
export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
/** Never leak internals: unknown errors collapse to a generic message. */
export function publicMessage(e: unknown): { code: ErrorCode; message: string } {
  if (isAppError(e)) return { code: e.code, message: e.message };
  return { code: "INTERNAL", message: "Something went wrong. Please try again." };
}
