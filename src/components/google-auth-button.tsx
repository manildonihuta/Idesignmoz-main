"use client";

import { useState } from "react";

export function GoogleAuthButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogle() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google", { method: "GET" });
      const result = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !result.url) {
        setError(result.error ?? "Não foi possível iniciar sessão com o Google.");
        return;
      }
      window.location.href = result.url;
    } catch {
      setError("Não foi possível iniciar sessão com o Google.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        <span
          style={{
            color: "var(--muted)",
            fontSize: 10,
            fontFamily: "'DM Mono',monospace",
            textTransform: "uppercase",
            letterSpacing: ".14em",
          }}
        >
          ou
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

      <button
        type="button"
        className="outline-button"
        style={{ width: "100%" }}
        onClick={handleGoogle}
        disabled={loading}
      >
        <GoogleIcon />
        {loading ? "A ligar ao Google…" : "Continuar com o Google"}
      </button>

      {error && <p style={{ color: "#ff5d76", fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.92 12c0-.8.13-1.57.35-2.29V6.62H1.29A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}