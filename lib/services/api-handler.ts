import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AuthenticationError } from "@/lib/auth/context";
import { AuthorizationError } from "@/lib/auth/rbac";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "./errors";

/**
 * Tangani seluruh error API secara terpusat dengan status code HTTP yang sesuai,
 * sertakan kode error terstruktur (machine-readable) untuk firmware IoT & API client,
 * dan sembunyikan informasi sensitif / stack trace dari publik.
 *
 * PENTING: error kontrol internal Next.js (bail-out prerender saat `cookies()`
 * dipakai di route dinamis, `redirect()`, `notFound()`) HARUS dilempar kembali.
 * Bila ditelan di sini, Next.js mencoba merender statis lalu mencatatnya sebagai
 * `API_SERVER_ERROR` dan mengembalikan 500 saat build.
 */
export function handleApiError(error: unknown) {
  unstable_rethrow(error);

  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: error.message, code: error.code || "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.message, code: error.code || "FORBIDDEN" },
      { status: 403 }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validasi data gagal.",
        code: "VALIDATION_ERROR",
        details: error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code || "VALIDATION_ERROR",
        details: error.details,
      },
      { status: 400 }
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message, code: error.code || "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (error instanceof ConflictError) {
    return NextResponse.json(
      { error: error.message, code: error.code || "CONFLICT" },
      { status: 409 }
    );
  }

  if (error instanceof BusinessRuleError) {
    return NextResponse.json(
      { error: error.message, code: error.code || "BUSINESS_RULE_VIOLATION" },
      { status: 422 }
    );
  }

  // Log server internal error tanpa mencetak credential
  console.error(
    "[API_SERVER_ERROR]",
    error instanceof Error ? error.message : String(error)
  );

  return NextResponse.json(
    {
      error: "Terjadi kesalahan sistem internal. Silakan hubungi administrator.",
      code: "INTERNAL_SERVER_ERROR",
    },
    { status: 500 }
  );
}
