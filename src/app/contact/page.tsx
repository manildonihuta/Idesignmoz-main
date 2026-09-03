"use client";

import { FormEvent, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSent(true); }
  return <div className="site-shell"><SiteHeader /><main className="inner-page section-wrap contact-page"><div className="page-hero"><p className="eyebrow"><span className="pulse" /> Inicie uma conversa</p><h1>Conte-nos o que<br />está a <em>construir.</em></h1><p>Dê-nos a versão inicial. Nós ajudamos a encontrar a melhor.</p></div>{sent ? <div className="form-success"><strong>Pedido enviado.</strong><p>Obrigado. A nossa equipa entrará em contacto consigo em breve.</p><button className="outline-button" type="button" onClick={() => setSent(false)}>Enviar outro pedido <span aria-hidden="true">↗</span></button></div> : <form className="contact-form" onSubmit={handleSubmit}><label>Nome<input required placeholder="O seu nome" /></label><label>Email profissional<input required type="email" placeholder="voce@empresa.com" /></label><label>Como podemos ajudar?<select required defaultValue=""><option value="" disabled>Seleccione um serviço</option><option>Design de website</option><option>Identidade de marca</option><option>Alojamento</option><option>Outra necessidade</option></select></label><label>Conte-nos mais<textarea rows={5} placeholder="Algumas palavras sobre a sua ideia, prazo ou ambição..." /></label><button className="button" type="submit">Enviar pedido <span aria-hidden="true">↗</span></button></form>}</main><SiteFooter /></div>;
}
