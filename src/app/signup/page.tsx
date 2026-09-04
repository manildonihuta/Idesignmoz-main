"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { signupSchema, type SignupInput } from "@/lib/schemas";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(data: SignupInput) {
    setLoading(true);
    setError("");
    try {
      const { data: result, error: authError } = await supabaseBrowser.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.full_name, company: data.company || null },
          emailRedirectTo: window.location.origin,
        },
      });
      if (authError) {
        setError(authError.message === "User already registered"
          ? "Já existe uma conta com este email."
          : authError.message);
        return;
      }
      setDone(true);
      setNeedsConfirm(!result.session);
    } catch {
      setError("Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  const fieldError = (msg?: string) =>
    msg ? <span style={{ color: "#ff5d76", fontSize: 12, display: "block", marginTop: 4 }}>{msg}</span> : null;

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="inner-page section-wrap auth-page">
        <div className="auth-panel">
          <p className="eyebrow"><span className="pulse" /> Portal do cliente</p>
          <h1>Crie a sua<br /><em>conta.</em></h1>
          {done ? (
            <div className="form-success">
              <strong>{needsConfirm ? "Confirme o seu email." : "Conta criada."}</strong>
              <p>{needsConfirm ? "Enviámos um link de confirmação para o seu email. Verifique a sua caixa de entrada." : "A sua conta foi criada. Já pode entrar."}</p>
              <Link className="text-link" href="/login">Ir para o início de sessão <span aria-hidden="true">↗</span></Link>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <label>Nome
                <input {...register("full_name")} placeholder="O seu nome" />
                {fieldError(errors.full_name?.message)}
              </label>
              <label>Empresa
                <input {...register("company")} placeholder="Opcional" />
              </label>
              <label>Email
                <input {...register("email")} type="email" placeholder="voce@empresa.com" autoComplete="email" />
                {fieldError(errors.email?.message)}
              </label>
              <label>Palavra-passe
                <input {...register("password")} type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                {fieldError(errors.password?.message)}
              </label>
              {error && <p style={{ color: "#ff5d76", fontSize: 13 }}>{error}</p>}
              <button className="button" type="submit" disabled={loading}>
                {loading ? "A criar…" : "Criar conta"} <span aria-hidden="true">↗</span>
              </button>
            </form>
          )}
          <p className="auth-note">Já tem uma conta? <Link href="/login">Entrar</Link></p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
