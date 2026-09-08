"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactInput } from "@/lib/schemas";

const SERVICES = ["Design de website", "Identidade de marca", "Alojamento", "Outra necessidade"];

export default function ContactView() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", service: "Outra necessidade", message: "" },
  });

  async function onSubmit(data: ContactInput) {
    setSending(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSubmitError(json.error ?? "Não foi possível enviar o pedido.");
        return;
      }
      setSent(true);
    } catch {
      setSubmitError("Não foi possível enviar o pedido.");
    } finally {
      setSending(false);
    }
  }

  const fieldError = (msg?: string) =>
    msg ? <span style={{ color: "#ff5d76", fontSize: 12, marginTop: 4, display: "block" }}>{msg}</span> : null;

  return (
    <main id="main" className="inner-page section-wrap contact-page">
      <div className="page-hero">
        <p className="eyebrow"><span className="pulse" /> Inicie uma conversa</p>
        <h1>Conte-nos o que<br />está a <em>construir.</em></h1>
        <p>Dê-nos a versão inicial. Nós ajudamos a encontrar a melhor.</p>
      </div>
      {sent ? (
        <div className="form-success">
          <strong>Pedido enviado.</strong>
          <p>Obrigado. A nossa equipa entrará em contacto consigo em breve.</p>
          <button className="outline-button" type="button" onClick={() => { setSent(false); reset(); }}>
            Enviar outro pedido <span aria-hidden="true">↗</span>
          </button>
        </div>
      ) : (
        <form className="contact-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label>Nome
            <input {...register("name")} placeholder="O seu nome" autoComplete="name" />
            {fieldError(errors.name?.message)}
          </label>
          <label>Email profissional
            <input {...register("email")} type="email" placeholder="voce@empresa.com" autoComplete="email" />
            {fieldError(errors.email?.message)}
          </label>
          <label>Como podemos ajudar?
            <select {...register("service")} defaultValue="">
              <option value="" disabled>Seleccione um serviço</option>
              {SERVICES.map((s) => <option key={s}>{s}</option>)}
            </select>
            {fieldError(errors.service?.message)}
          </label>
          <label>Conte-nos mais
            <textarea {...register("message")} rows={5} placeholder="Algumas palavras sobre a sua ideia, prazo ou ambição..." />
            {fieldError(errors.message?.message)}
          </label>
          {submitError && <p style={{ color: "#ff5d76", fontSize: 13 }}>{submitError}</p>}
          <button className="button" type="submit" disabled={sending}>
            {sending ? "A enviar…" : "Enviar pedido"} <span aria-hidden="true">↗</span>
          </button>
        </form>
      )}
    </main>
  );
}