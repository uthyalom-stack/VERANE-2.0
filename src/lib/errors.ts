export type ErrorCode =
  | "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT"
  | "OUT_OF_STOCK" | "RATE_LIMITED" | "PROVIDER" | "CONFIG" | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  RATE_LIMITED: 429,
  PROVIDER: 502,
  CONFIG: 500,
  INTERNAL: 500,
};

/** Application errors use the stable code-first API. */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = STATUS_BY_CODE[code];
  }
}

/** Backwards-compatible domain errors used by the original API/auth layer. */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION", message, details);
    this.name = "ValidationError";
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHENTICATED", message);
    this.name = "UnauthorizedError";
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}
export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super("CONFLICT", message, details);
    this.name = "ConflictError";
  }
}
export class InfrastructureError extends AppError {
  constructor(message = "An infrastructure error occurred", details?: unknown) {
    super("INTERNAL", message, details);
    this.name = "InfrastructureError";
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/** Never leak internals: unknown errors collapse to a generic message. */
export function publicMessage(e: unknown): { code: ErrorCode; message: string } {
  if (isAppError(e)) return { code: e.code, message: e.message };
  return { code: "INTERNAL", message: "Something went wrong. Please try again." };
}

/** Stable response shape retained for the original smoke-test/API callers. */
export function formatErrorForClient(error: unknown): {
  error: { message: string; code: string; statusCode: number; details?: unknown };
} {
  if (error instanceof ValidationError) {
    return { error: { message: error.message, code: "VALIDATION_ERROR", statusCode: 400, ...(error.details === undefined ? {} : { details: error.details }) } };
  }
  if (error instanceof UnauthorizedError) {
    return { error: { message: error.message, code: "UNAUTHENTICATED", statusCode: 401 } };
  }
  if (error instanceof ForbiddenError) {
    return { error: { message: error.message, code: "FORBIDDEN", statusCode: 403 } };
  }
  if (error instanceof NotFoundError) {
    return { error: { message: error.message, code: "NOT_FOUND", statusCode: 404 } };
  }
  if (error instanceof AppError) {
    const code = error.code === "VALIDATION" ? "VALIDATION_ERROR"
      : error.code === "INTERNAL" ? "INTERNAL_ERROR"
      : error.code;
    return {
      error: {
        message: error.code === "INTERNAL" ? "An unexpected error occurred" : error.message,
        code,
        statusCode: error.statusCode,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
  }
  return { error: { message: "An unexpected error occurred", code: "INTERNAL_ERROR", statusCode: 500 } };
}
