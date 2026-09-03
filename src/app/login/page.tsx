"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function LoginPage() {
  const [submitted, setSubmitted] = useState(false);
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSubmitted(true); }
  return <div className="site-shell"><SiteHeader /><main className="inner-page section-wrap auth-page"><div className="auth-panel"><p className="eyebrow"><span className="pulse" /> Portal do cliente</p><h1>Bem-vindo<br /><em>de volta.</em></h1>{submitted ? <div className="form-success"><strong>Pedido recebido.</strong><p>Em produção, a autenticação será ligada à sua conta de cliente.</p><Link className="text-link" href="/">Voltar à página inicial <span aria-hidden="true">↗</span></Link></div> : <form className="contact-form" onSubmit={handleSubmit}><label>Email<input required type="email" placeholder="voce@empresa.com" /></label><label>Palavra-passe<input required type="password" placeholder="A sua palavra-passe" /></label><button className="button" type="submit">Entrar <span aria-hidden="true">↗</span></button></form>}<p className="auth-note">Ainda não tem uma conta? <Link href="/contact">Fale connosco</Link></p></div></main><SiteFooter /></div>;
}
