import bcrypt from "bcryptjs";

export const SALT_ROUNDS = 12;

/**
 * Hash password plaintext menggunakan bcrypt dengan salt rounds 12
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifikasi password plaintext terhadap hash yang tersimpan di database
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
