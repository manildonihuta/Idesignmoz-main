"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { GoogleAuthButton } from "@/components/google-auth-button";

export default function LoginPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setSubmitError(result.error ?? "Email ou palavra-passe incorrectos.");
        return;
      }
      setSuccess(true);
      router.push("/");
    } catch {
      setSubmitError("Não foi possível iniciar sessão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-panel">
      <p className="eyebrow"><span className="pulse" /> Portal do cliente</p>
      <h1>Bem-vindo<br /><em>de volta.</em></h1>
      {success ? (
        <div className="form-success">
          <strong>Sessão iniciada.</strong>
          <p>Bem-vindo de volta. A iniciar o seu portal…</p>
          <Link className="text-link" href="/">Ir para a página inicial <span aria-hidden="true">↗</span></Link>
        </div>
      ) : (
        <>
          <form className="contact-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label>Email
            <input {...register("email")} type="email" placeholder="voce@empresa.com" autoComplete="email" />
            {errors.email && <span style={{ color: "#ff5d76", fontSize: 12, display: "block", marginTop: 4 }}>{errors.email.message}</span>}
          </label>
          <label>Palavra-passe
            <input {...register("password")} type="password" placeholder="A sua palavra-passe" autoComplete="current-password" />
            {errors.password && <span style={{ color: "#ff5d76", fontSize: 12, display: "block", marginTop: 4 }}>{errors.password.message}</span>}
          </label>
          {submitError && <p style={{ color: "#ff5d76", fontSize: 13 }}>{submitError}</p>}
          <button className="button" type="submit" disabled={loading}>
            {loading ? "A entrar…" : "Entrar"} <span aria-hidden="true">↗</span>
          </button>
        </form>
          <GoogleAuthButton />
        </>
      )}
      <p className="auth-note">Ainda não tem uma conta? <Link href="/signup">Criar conta</Link></p>
    </div>
  );
}