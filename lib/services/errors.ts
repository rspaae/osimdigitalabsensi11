/**
 * Custom domain error classes for consistent HTTP error handling across API route handlers.
 * Supports machine-readable error codes for IoT firmware and API clients.
 */

export class ValidationError extends Error {
  public details?: unknown;
  public code: string;

  constructor(
    message = "Data yang dikirim tidak valid.",
    details?: unknown,
    code = "VALIDATION_ERROR"
  ) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
    this.code = code;
  }
}

export class NotFoundError extends Error {
  public code: string;

  constructor(
    message = "Data yang dicari tidak ditemukan.",
    code = "NOT_FOUND"
  ) {
    super(message);
    this.name = "NotFoundError";
    this.code = code;
  }
}

export class ConflictError extends Error {
  public code: string;

  constructor(
    message = "Terjadi konflik data atau duplikasi entitas.",
    code = "CONFLICT"
  ) {
    super(message);
    this.name = "ConflictError";
    this.code = code;
  }
}

export class BusinessRuleError extends Error {
  public code: string;

  constructor(
    message = "Operasi melanggar aturan bisnis sistem.",
    code = "BUSINESS_RULE_VIOLATION"
  ) {
    super(message);
    this.name = "BusinessRuleError";
    this.code = code;
  }
}
