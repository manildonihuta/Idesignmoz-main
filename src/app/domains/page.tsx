"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const extensions = [[".co.mz", "2,500 MT", "2,500 MT", "Negócios locais"], [".com", "1,900 MT", "2,200 MT", "Padrão global"], [".africa", "2,800 MT", "2,800 MT", "Feito para África"], [".tech", "2,400 MT", "2,700 MT", "Tecnologia"], [".shop", "2,100 MT", "2,500 MT", "Lojas online"]];

export default function DomainsPage() {
  const [domain, setDomain] = useState("");
  const [extension, setExtension] = useState(".co.mz");
  const [searched, setSearched] = useState(false);
  function handleSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (domain.trim()) setSearched(true); }
  const cleanDomain = domain.toLowerCase().replaceAll(" ", "");
  return <div className="site-shell"><SiteHeader /><main className="inner-page section-wrap"><div className="page-hero page-hero-split"><div><p className="eyebrow"><span className="pulse" /> O seu lugar começa aqui</p><h1>Encontre um nome<br />que vale a pena <em>ter.</em></h1></div><p>Pesquise, registe e gira o seu domínio num só lugar, simples e tranquilo.</p></div><form className="domain-form domain-form-page" onSubmit={handleSearch}><input value={domain} onChange={(event) => { setDomain(event.target.value); setSearched(false); }} aria-label="Nome do domínio" placeholder="oseunegocio" /><select value={extension} onChange={(event) => setExtension(event.target.value)} aria-label="Extensão do domínio"><option>.co.mz</option><option>.com</option><option>.africa</option><option>.tech</option></select><button className="button" type="submit">Pesquisar domínio <span aria-hidden="true">↗</span></button></form>{searched && <div className="domain-result"><span className="result-check">✓</span><span><strong>{cleanDomain}{extension}</strong><small>Disponível para registo</small></span><b>2,500 MT / ano</b><Link href="/contact" className="result-link">Adicionar ao carrinho <span aria-hidden="true">↗</span></Link></div>}<div className="section-kicker table-kicker"><span>01</span><span className="rule" /><span>Preços de domínios</span></div><div className="extension-table"><div className="extension-row extension-head"><span>Extensão</span><span>Registo</span><span>Renovação</span><span>Ideal para</span><span /></div>{extensions.map(([extension, registration, renewal, use]) => <div className="extension-row" key={extension}><strong>{extension}</strong><span>{registration}</span><span>{renewal}</span><span>{use}</span><Link href="/contact">Registar <span aria-hidden="true">↗</span></Link></div>)}</div></main><SiteFooter /></div>;
}
