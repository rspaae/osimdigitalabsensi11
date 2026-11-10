/**
 * Utilitas sanitasi dan validasi keamanan untuk alur autentikasi & CSRF.
 */

/**
 * Sanitasi URL pengalihan (redirect URL) untuk mencegah Open Redirect Vulnerability.
 * Hanya mengizinkan relative path lokal yang diawali dengan '/' tunggal.
 * Menolak URL eksternal (misal: 'https://evil.com'), protocol-relative ('//evil.com', '/\evil.com'),
 * dan skrip berbahaya ('javascript:...').
 */
export function sanitizeRedirectUrl(
  url: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!url || typeof url !== "string") {
    return fallback;
  }

  const trimmed = url.trim();

  // 1. Harus diawali dengan karakter '/' tunggal
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // 2. Tolak protocol-relative URL: '//' atau '/\'
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // 3. Tolak karakter berbahaya seperti control chars atau newline
  if (/[\r\n\t]/.test(trimmed)) {
    return fallback;
  }

  // 4. Pastikan path aman ketika digabungkan dengan base domain dummy
  try {
    const dummyOrigin = "http://localhost";
    const parsed = new URL(trimmed, dummyOrigin);

    // Hostname harus tetap dummyOrigin dan protokol http
    if (parsed.origin !== dummyOrigin) {
      return fallback;
    }

    // Mengembalikan path aman beserta query params jika ada
    const safePath = parsed.pathname + parsed.search + parsed.hash;
    return safePath.startsWith("/") && !safePath.startsWith("//")
      ? safePath
      : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Validasi header Origin / Host untuk perlindungan CSRF pada request mutasi state.
 */
export function validateRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Jika tidak ada origin header (misal same-origin form POST atau GET navigation), izinkan
  if (!origin || !host) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}
