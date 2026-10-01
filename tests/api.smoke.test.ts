import { describe, it, expect } from "vitest";
import { formatErrorForClient, ValidationError } from "../src/lib/errors";

describe("API Security & Error Handling Smoke Test", () => {
  it("should correctly format AppErrors for client response", () => {
    const error = new ValidationError("Invalid request body", { field: "email" });
    const formatted = formatErrorForClient(error);

    expect(formatted).toEqual({
      error: {
        message: "Invalid request body",
        code: "VALIDATION_ERROR",
        statusCode: 400,
        details: { field: "email" },
      },
    });
  });

  it("should obscure unexpected errors for client response", () => {
    const unexpectedError = new Error("Database connection password leaked");
    const formatted = formatErrorForClient(unexpectedError);

    expect(formatted).toEqual({
      error: {
        message: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
        statusCode: 500,
      },
    });
  });
});
