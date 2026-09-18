"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { addToCart } from "@/lib/cart";
import { trackEvent } from "@/lib/analytics-client";
import { DomainCard, Button } from "@/components/ui/core";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

type Extension = {
  extension: string;
  registration: number;
  renewal: number;
  ideal_for?: string | null;
};

type CheckResult = {
  available: boolean;
  fullDomain: string;
  name: string;
  extension: string;
  price?: number;
  renewal?: number;
  status?: string;
  error?: string;
};

type Whois = {
  registrar: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  lastChanged: string | null;
  status: string[];
  externalUrl?: string;
};

type Hint = { full: string; state: "checking" | "available" | "taken" | "error" };

function sanitizeName(raw: string): string {
  const name = raw.toLowerCase().replace(/\s+/g, "").trim();
  if (!name || name.length < 2 || name.length > 63) return "";
  if (!/^[a-z0-9-]+$/.test(name)) return "";
  if (name.startsWith("-") || name.endsWith("-")) return "";
  return name;
}

function fmt(price?: number): string {
  return new Intl.NumberFormat("pt-MZ").format(price ?? 0);
}

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function DomainSearch() {
  const [query, setQuery] = useState("");
  const [extension, setExtension] = useState(".com");
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whois, setWhois] = useState<Whois | null>(null);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<CheckResult[] | null>(null);
  const [altLoading, setAltLoading] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const widgetRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/domains/extensions")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setExtensions(data.extensions);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const name = sanitizeName(query);
  const combos =
    open && name
      ? extensions.map((ext) => ({
          fullDomain: `${name}${ext.extension}`,
          name,
          ext,
        }))
      : [];

  const runCheck = useCallback(
    async (nameToCheck: string, ext: string) => {
      if (!nameToCheck) return;
      setLoading(true);
      setResult(null);
      setWhois(null);
      setAlternatives(null);
      setAdded(null);
      setError(null);
      trackEvent({ event: "domain_search", page: window.location.pathname, meta: { name: nameToCheck, ext } });
      try {
        const res = await fetch(
          `/api/domains/check?name=${encodeURIComponent(nameToCheck)}&extension=${encodeURIComponent(ext)}`,
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong.");
        } else {
          setResult(data);
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    const n = sanitizeName(query);
    if (!n) {
      return;
    }
    const full = `${n}${extension}`;
    hintTimer.current = setTimeout(async () => {
      setHint({ full, state: "checking" });
      try {
        const res = await fetch(
          `/api/domains/check?name=${encodeURIComponent(n)}&extension=${encodeURIComponent(extension)}`,
        );
        const data = await res.json();
        setHint({
          full,
          state: res.ok
            ? data.available
              ? "available"
              : "taken"
            : "error",
        });
      } catch {
        setHint({ full, state: "error" });
      }
    }, 450);
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [query, extension]);

  function pick(combo: { fullDomain: string; name: string; ext: Extension }) {
    setQuery(combo.name);
    setExtension(combo.ext.extension);
    setOpen(false);
    runCheck(combo.name, combo.ext.extension);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = sanitizeName(query);
    if (n) {
      setOpen(false);
      runCheck(n, extension);
    }
  }

  function onAdd(item: CheckResult) {
    addToCart({
      fullDomain: item.fullDomain,
      extension: item.extension,
      price: item.price ?? 0,
      currency: "MZN",
      kind: "registration",
      label: `${item.fullDomain} · registro 1 ano`,
      period: "annual",
      category: "domain",
    });
    setAdded(item.fullDomain);
    trackEvent({ event: "cart_add", page: window.location.pathname, value: item.price ?? 0 });
  }

  async function loadWhois() {
    if (!result) return;
    setWhoisLoading(true);
    setWhois(null);
    try {
      const res = await fetch(`/api/domains/whois?domain=${encodeURIComponent(result.fullDomain)}`);
      const data = await res.json();
      setWhois(data.ok ? data.whois : null);
    } catch {
      setWhois(null);
    } finally {
      setWhoisLoading(false);
    }
  }

  async function findAlternatives() {
    const n = result?.name ?? name;
    if (!n) return;
    setAltLoading(true);
    setAlternatives([]);
    const found: CheckResult[] = [];
    for (const ext of extensions) {
      if (ext.extension === result?.extension) continue;
      try {
        const res = await fetch(
          `/api/domains/check?name=${encodeURIComponent(n)}&extension=${encodeURIComponent(ext.extension)}`,
        );
        const data = await res.json();
        if (res.ok && data.available) {
          found.push(data);
          if (found.length >= 3) break;
        }
      } catch {
        // keep going
      }
    }
    setAlternatives(found);
    setAltLoading(false);
  }

  return (
    <div className="domain-widget" ref={widgetRef}>
      <form className="domain-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="domain">Search your domain</label>
        <input
          id="domain"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setResult(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="yourbusiness"
          autoComplete="off"
        />
        <DropdownMenu
          options={extensions.map((ext) => ({
            label: ext.extension,
            onClick: () => {
              setExtension(ext.extension);
              setResult(null);
            },
          }))}
          className="bg-[#11111198] border-none text-white h-full px-4 rounded-xl"
        >
          {extension}
        </DropdownMenu>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Checking…" : "Search Domain"} <Arrow />
        </button>
      </form>

      {combos.length > 0 && (
        <div className="domain-suggest" role="listbox">
          <p className="domain-suggest-label">Suggestions</p>
          {combos.map((combo) => (
            <button
              type="button"
              key={combo.fullDomain}
              role="option"
              aria-selected={false}
              onClick={() => pick(combo)}
            >
              {combo.fullDomain}
            </button>
          ))}
        </div>
      )}

      {hint && (
        <p className="domain-hint" aria-live="polite">
          <span className={`hint-dot ${hint.state}`} />
          {hint.full} —{" "}
          {hint.state === "checking"
            ? "Checking…"
            : hint.state === "available"
              ? "AVAILABLE"
              : hint.state === "taken"
                ? "TAKEN"
                : "unavailable"}
        </p>
      )}

      {error && <p className="domain-error" role="alert">{error}</p>}

      {result?.available ? (
        <DomainCard
          domain={result.fullDomain}
          status="available"
          price={<>{fmt(result.price)} MT</>}
          renewal={<>{fmt(result.renewal ?? result.price)} MT</>}
          actions={
            <>
              <Button size="sm" type="button" disabled={added === result.fullDomain} onClick={() => onAdd(result)}>
                {added === result.fullDomain ? "Added to cart ✓" : "Add to Cart"}
              </Button>
              {added === result.fullDomain && (
                <Link className="text-link" href="/cart" onClick={() => setAdded(null)}>
                  View cart <Arrow />
                </Link>
              )}
            </>
          }
        />
      ) : result ? (
        <div className="domain-result-panel taken">
          <div className="domain-card-top">
            <strong>{result.fullDomain}</strong>
            <span className="domain-badge taken">TAKEN</span>
          </div>
          <div className="domain-card-actions">
            <Button variant="brandOutline" size="sm" type="button" onClick={loadWhois} disabled={whoisLoading} loading={whoisLoading}>
              {whoisLoading ? "Loading…" : "WHOIS"}
            </Button>
            <Button variant="brandOutline" size="sm" type="button" onClick={findAlternatives} disabled={altLoading} loading={altLoading}>
              {altLoading ? "Checking…" : "Find Alternatives"}
            </Button>
          </div>

          {whois && (
            <div className="domain-whois">
              <dl>
                {whois.registrar && (
                  <div>
                    <dt>Registrar</dt>
                    <dd>{whois.registrar}</dd>
                  </div>
                )}
                {whois.registrationDate && (
                  <div>
                    <dt>Registered</dt>
                    <dd>{new Date(whois.registrationDate).toLocaleDateString("pt-PT")}</dd>
                  </div>
                )}
                {whois.expirationDate && (
                  <div>
                    <dt>Expires</dt>
                    <dd>{new Date(whois.expirationDate).toLocaleDateString("pt-PT")}</dd>
                  </div>
                )}
                {whois.status && whois.status.length > 0 && (
                  <div>
                    <dt>Status</dt>
                    <dd>{whois.status.join(", ")}</dd>
                  </div>
                )}
              </dl>
              {whois.externalUrl && (
                <a className="text-link" href={whois.externalUrl} target="_blank" rel="noreferrer">
                  Open full WHOIS <Arrow />
                </a>
              )}
            </div>
          )}

          {alternatives !== null && (
            <div className="domain-alternatives">
              <p className="domain-suggest-label">
                {alternatives.length === 0
                  ? "No domains found for this name. Try another name or explore our suggestions."
                  : "Available alternatives"}
              </p>
              {alternatives.map((alt) => (
                <div className="domain-alt-row" key={alt.fullDomain}>
                  <span>{alt.fullDomain}</span>
                  <b>{fmt(alt.price)} MT</b>
                  <Button
                    size="sm"
                    type="button"
                    disabled={added === alt.fullDomain}
                    onClick={() => onAdd(alt)}
                  >
                    {added === alt.fullDomain ? "Added ✓" : "Add to Cart"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}