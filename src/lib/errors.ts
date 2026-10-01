export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code = "INTERNAL_ERROR", statusCode = 500, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden access") {
    super(message, "FORBIDDEN", 403);
  }
}

export class InfrastructureError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "INFRASTRUCTURE_ERROR", 500, details);
  }
}

export function formatErrorForClient(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  return {
    error: {
      message: "An unexpected error occurred",
      code: "INTERNAL_ERROR",
      statusCode: 500,
    },
  };
}
