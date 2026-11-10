import { Role, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "./password";
import {
  setupSuperadminSchema,
  type SetupSuperadminInput,
} from "@/lib/validators/setup.schema";

export interface SetupResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    role: Role;
  };
}

/**
 * Mendapatkan kunci rahasia inisialisasi Superadmin dari variabel lingkungan.
 * Mendukung INITIAL_SUPERADMIN_SECRET atau SETUP_SECRET.
 */
export function getSetupSecret(): string | null {
  const secret =
    process.env.INITIAL_SUPERADMIN_SECRET || process.env.SETUP_SECRET;
  if (!secret || secret.trim().length < 16) {
    return null;
  }
  return secret.trim();
}

/**
 * Inisialisasi akun SUPERADMIN perdana secara aman.
 * 
 * Aturan Keamanan:
 * 1. Menolak jika sudah ada akun SUPERADMIN dalam basis data.
 * 2. Memeriksa validitas setup secret dari server environment.
 * 3. Menjalankan pemeriksaan dan pembuatan akun di dalam Prisma interactive transaction
 *    untuk mencegah race condition (eksekusi konkuren).
 * 4. Password di-hash menggunakan bcrypt 12 rounds — raw password tidak pernah disimpan atau direturn.
 */
export async function setupInitialSuperadmin(
  input: SetupSuperadminInput
): Promise<SetupResult> {
  const parsed = setupSuperadminSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Input setup tidak valid",
    };
  }

  const { username, email, password, setupSecret } = parsed.data;

  // 1. Verifikasi ketersediaan kunci setup rahasia di server
  const configuredSecret = getSetupSecret();
  if (!configuredSecret) {
    return {
      success: false,
      error:
        "INITIAL_SUPERADMIN_SECRET belum dikonfigurasi di server (minimal 16 karakter).",
    };
  }

  // 2. Verifikasi kesesuaian kunci rahasia
  if (setupSecret !== configuredSecret) {
    return {
      success: false,
      error: "Kunci otorisasi setup tidak sah.",
    };
  }

  // 3. Eksekusi transaksi atomik dengan serialisasi konkurensi tingkat database
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Serialisasi mutlak via PostgreSQL Transaction Advisory Lock
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('setup_superadmin_lock'));`;

        // Pastikan belum ada SUPERADMIN
        const existingSuperadmin = await tx.user.findFirst({
          where: { role: Role.SUPERADMIN },
        });

        if (existingSuperadmin) {
          return {
            success: false,
            error: "Inisialisasi ditolak: Akun SUPERADMIN sudah ada dalam sistem.",
          };
        }

        // Pastikan username atau email belum terdaftar
        const existingUser = await tx.user.findFirst({
          where: {
            OR: [{ username }, { email }],
          },
        });

        if (existingUser) {
          return {
            success: false,
            error: "Username atau email sudah digunakan oleh akun lain.",
          };
        }

        // Hash password dengan salt rounds 12
        const passwordHash = await hashPassword(password);

        // Buat akun Superadmin pertama
        const createdUser = await tx.user.create({
          data: {
            username,
            email,
            password_hash: passwordHash,
            role: Role.SUPERADMIN,
            admin_scope: null,
            is_active: true,
          },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        });

        return {
          success: true,
          user: createdUser,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  } catch (err) {
    console.error(
      "[setupInitialSuperadmin] Gagal membuat Superadmin:",
      err instanceof Error ? err.message : err
    );
    return {
      success: false,
      error: "Terjadi kesalahan internal pada server saat inisialisasi basis data.",
    };
  }
}
