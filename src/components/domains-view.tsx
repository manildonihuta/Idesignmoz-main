"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { domainOrderSchema, type DomainOrderInput } from "@/lib/schemas";
import { trackEvent } from "@/lib/analytics-client";

type ExtensionRow = {
  extension: string;
  registration: number;
  renewal: number;
  ideal_for: string;
};

const formatMT = (n: number) => `${n.toLocaleString("pt-PT")} MT`;

type CheckResult = {
  available: boolean;
  fullDomain: string;
  name: string;
  extension: string;
  status: string;
  price: number;
  renewal?: number;
  error?: string;
};

export default function DomainsView({ initialExtensions = [] }: { initialExtensions?: ExtensionRow[] }) {
  const [domain, setDomain] = useState("");
  const [extension, setExtension] = useState(".co.mz");
  const [extensions, setExtensions] = useState<ExtensionRow[]>(initialExtensions);
  const [loadingExtensions, setLoadingExtensions] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const [ordering, setOrdering] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [orderError, setOrderError] = useState("");

  const {
    register: registerOrder,
    handleSubmit: handleOrderSubmit,
    formState: { errors: orderErrors },
  } = useForm<DomainOrderInput>({ resolver: zodResolver(domainOrderSchema) });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/domains/extensions")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled || !data?.ok || !Array.isArray(data.extensions) || data.extensions.length === 0) return;
        setExtensions(data.extensions);
        setExtension((current) => (data.extensions.some((e: ExtensionRow) => e.extension === current) ? current : data.extensions[0].extension));
      })
      .catch(() => {
        /* keep server-provided list */
      })
      .finally(() => {
        if (!cancelled) setLoadingExtensions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!domain.trim()) return;
    setChecking(true);
    setOrdered(false);
    setResult(null);
    setOrderError("");
    trackEvent({ event: "domain_search", page: window.location.pathname, meta: { name: domain, ext: extension } });
    try {
      const res = await fetch(`/api/domains/check?name=${encodeURIComponent(domain)}&extension=${encodeURIComponent(extension)}`);
      const data: CheckResult = await res.json();
      setResult(data);
    } catch {
      setResult({ available: false, fullDomain: "", name: domain, extension, status: "error", price: 0, error: "Não foi possível verificar o domínio." });
    } finally {
      setChecking(false);
    }
  }

  async function handleOrder(data: DomainOrderInput) {
    if (!result?.available) return;
    setOrdering(true);
    setOrderError("");
    try {
      const res = await fetch("/api/domains/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, email: data.email, fullDomain: result.fullDomain, extension: result.extension }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.ok) {
        setOrderError(resData.error ?? "Não foi possível registar o pedido.");
        return;
      }
      setOrdered(true);
    } catch {
      setOrderError("Não foi possível registar o pedido.");
    } finally {
      setOrdering(false);
    }
  }

  function selectExtension(ext: string) {
    setExtension(ext);
    setResult(null);
    setOrdered(false);
    setOrderError("");
  }

  return (
    <main id="main" className="inner-page section-wrap">
      <div className="page-hero page-hero-split">
        <div>
          <p className="eyebrow"><span className="pulse" /> O seu lugar começa aqui</p>
          <h1>Encontre um nome<br />que vale a pena <em>ter.</em></h1>
        </div>
        <p>Pesquise, registe e gira o seu domínio num só lugar, simples e tranquilo.</p>
      </div>

      <form className="domain-form domain-form-page" onSubmit={handleSearch}>
        <input value={domain} onChange={(event) => { setDomain(event.target.value); setResult(null); setOrdered(false); }} aria-label="Nome do domínio" placeholder="oseunegocio" />
        <select value={extension} onChange={(event) => selectExtension(event.target.value)} aria-label="Extensão do domínio">
          {extensions.map((ext) => <option key={ext.extension}>{ext.extension}</option>)}
        </select>
        <button className="button" type="submit" disabled={checking}>
          {checking ? "A verificar…" : "Pesquisar domínio"} <span aria-hidden="true">↗</span>
        </button>
      </form>

      {result && (
        result.available ? (
          ordered ? (
            <div className="domain-result">
              <span className="result-check">✓</span>
              <span><strong>{result.fullDomain}</strong><small>Pedido registado com sucesso — a nossa equipa vai contactá-lo em breve.</small></span>
              <b>{formatMT(result.price)} / ano</b>
              <Link href="/contact" className="result-link">Fale connosco <span aria-hidden="true">↗</span></Link>
            </div>
          ) : (
            <div className="domain-result">
              <span className="result-check">✓</span>
              <span><strong>{result.fullDomain}</strong><small>Disponível para registo</small></span>
              <b>{formatMT(result.price)} / ano</b>
            </div>
          )
        ) : (
          <div className="domain-result bg-brand/10">
            <span className="result-check">✕</span>
            <span><strong>{result.fullDomain || domain}</strong><small>{result.error || "Indisponível para registo"}</small></span>
          </div>
        )
      )}

      {result?.available && !ordered && (
        <form className="contact-form mt-10" onSubmit={handleOrderSubmit(handleOrder)} noValidate>
          <label>Nome
            <input {...registerOrder("name")} placeholder="O seu nome" />
            {orderErrors.name && <span style={{ color: "#ff5d76", fontSize: 12, display: "block", marginTop: 4 }}>{orderErrors.name.message}</span>}
          </label>
          <label>Email profissional
            <input {...registerOrder("email")} type="email" placeholder="voce@empresa.com" />
            {orderErrors.email && <span style={{ color: "#ff5d76", fontSize: 12, display: "block", marginTop: 4 }}>{orderErrors.email.message}</span>}
          </label>
          {orderError && <p style={{ color: "#ff5d76", fontSize: 13 }}>{orderError}</p>}
          <button className="button" type="submit" disabled={ordering}>
            {ordering ? "A registar…" : "Registar domínio"} <span aria-hidden="true">↗</span>
          </button>
        </form>
      )}

      <div className="section-kicker table-kicker"><span>01</span><span className="rule" /><span>Preços de domínios</span></div>
      <div className="extension-table">
        <div className="extension-row extension-head"><span>Extensão</span><span>Registo</span><span>Renovação</span><span>Ideal para</span><span /></div>
        {extensions.map((ext) =>
          <div className="extension-row" key={ext.extension}>
            <strong>{ext.extension}</strong>
            <span>{formatMT(ext.registration)}</span>
            <span>{formatMT(ext.renewal)}</span>
            <span>{ext.ideal_for}</span>
            <button type="button" className="result-link" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => selectExtension(ext.extension)}>Pesquisar <span aria-hidden="true">↗</span></button>
          </div>
        )}
        {!loadingExtensions && extensions.length === 0 && (
          <div className="extension-row"><span style={{ color: "#8e9088" }}>A consultar preços dos domínios — volte em instantes.</span></div>
        )}
      </div>
    </main>
  );
}