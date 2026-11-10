"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loginAction, type LoginActionState } from "@/app/actions/auth.actions";

interface LoginFormProps {
  redirectParam: string | null;
}

const initialState: LoginActionState = {};

export default function LoginForm({ redirectParam }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Fokuskan pesan error ke pembaca layar saat ada error baru
  useEffect(() => {
    if (state.error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [state.error]);

  return (
    <form action={formAction} noValidate aria-label="Formulir Login">
      {/* Hidden redirect field */}
      {redirectParam && (
        <input type="hidden" name="redirect" value={redirectParam} />
      )}

      {/* Error message */}
      {state.error && (
        <div
          role="alert"
          className="error-banner"
          aria-live="assertive"
        >
          <p ref={errorRef} tabIndex={-1} className="error-text">
            {state.error}
          </p>
        </div>
      )}

      {/* Username / Email field */}
      <div className="field-group">
        <label htmlFor="usernameOrEmail" className="field-label">
          Username atau Email
        </label>
        <input
          id="usernameOrEmail"
          name="usernameOrEmail"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={3}
          disabled={isPending}
          placeholder="Masukkan username atau email"
          className="field-input"
          aria-describedby={state.error ? "login-error" : undefined}
          aria-invalid={!!state.error}
        />
      </div>

      {/* Password field */}
      <div className="field-group">
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <div className="password-wrapper">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            minLength={6}
            disabled={isPending}
            placeholder="Masukkan password"
            className="field-input password-input"
            aria-invalid={!!state.error}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={isPending}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            className="password-toggle"
          >
            {showPassword ? (
              /* Eye-off icon */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                width={18}
                height={18}
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              /* Eye icon */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                width={18}
                height={18}
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isPending}
        className="submit-button"
        aria-busy={isPending}
      >
        {isPending ? (
          <span className="loading-content">
            <svg
              className="spinner"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              width={18}
              height={18}
              aria-hidden="true"
            >
              <circle
                className="spinner-track"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="spinner-arc"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Memproses...
          </span>
        ) : (
          "Masuk"
        )}
      </button>
    </form>
  );
}
