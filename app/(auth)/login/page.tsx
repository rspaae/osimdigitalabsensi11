import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/context";
import { sanitizeRedirectUrl } from "@/lib/auth/security";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Login",
};

// Route ini membaca cookie sesi — tidak bisa di-prerender sebagai static shell.
// Dideklarasikan sebagai blocking route sesuai panduan Next.js 16 Cache Components.
export const instant = false;

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Login depends on the incoming session cookie and renders the current year.
  // Keep both request-specific values out of the prerendered shell.
  await connection();

  // Jika pengguna sudah memiliki sesi valid, redirect langsung ke dashboard
  const user = await getSessionUser();
  if (user) {
    const params = await searchParams;
    const destination = sanitizeRedirectUrl(params.redirect, "/dashboard");
    redirect(destination);
  }

  const params = await searchParams;
  const rawRedirect = params.redirect ?? null;
  const sanitizedRedirect = rawRedirect
    ? sanitizeRedirectUrl(rawRedirect, "/dashboard")
    : null;

  return (
    <main className="login-page">
      <div className="login-container">
        {/* Header identitas organisasi */}
        <header className="login-header">
          <div className="org-logo" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              fill="none"
              width={48}
              height={48}
              aria-hidden="true"
            >
              {/* Shield icon — representasi organisasi & kepercayaan */}
              <path
                d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.5C34.3 44.3 42 34.5 42 24V12L24 4z"
                fill="#60A5FA"
                stroke="#2563EB"
                strokeWidth="2"
              />
              <path
                d="M24 4L6 12v12c0 10.5 7.7 20.3 18 22.5"
                fill="#93C5FD"
                opacity="0.55"
              />
              <path
                d="M18 23l4 4 8-8"
                stroke="#1E3A8A"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="org-identity">
            <span className="org-label">OSIS MPK</span>
            <h1 className="org-school">SMKN 11 BANDUNG</h1>
            <p className="app-name">Sistem Absensi &amp; Manajemen</p>
          </div>
        </header>

        {/* Card login */}
        <div className="login-card">
          <div className="card-heading">
            <h2 className="card-title">Masuk ke Sistem</h2>
            <p className="card-subtitle">
              Khusus untuk pengurus dan pembina yang terdaftar
            </p>
          </div>

          <LoginForm redirectParam={sanitizedRedirect} />
        </div>

        {/* Footer */}
        <footer className="login-footer">
          <p>
            &copy; {new Date().getFullYear()} OSIS MPK SMKN 11 Bandung.
            Hak cipta dilindungi.
          </p>
        </footer>
      </div>
    </main>
  );
}
