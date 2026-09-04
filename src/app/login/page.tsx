"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { loginSchema, type LoginInput } from "@/lib/schemas";

export default function LoginPage() {
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
      const { error: authError } = await supabaseBrowser.auth.signInWithPassword(data);
      if (authError) {
        setSubmitError(authError.message === "Invalid login credentials"
          ? "Email ou palavra-passe incorrectos."
          : authError.message);
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
    <div className="site-shell">
      <SiteHeader />
      <main className="inner-page section-wrap auth-page">
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
          )}
          <p className="auth-note">Ainda não tem uma conta? <Link href="/signup">Criar conta</Link></p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
