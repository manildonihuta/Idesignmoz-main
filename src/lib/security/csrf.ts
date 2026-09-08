import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function envOrigins(): string[] {
  const urls = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ].filter(Boolean) as string[];
  const hosts = new Set<string>();
  for (const url of urls) {
    const clean = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    if (clean) hosts.add(clean.toLowerCase());
  }
  return [...hosts];
}

function originToHost(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

export function csrfError(request: NextRequest): string | null {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return null;

  const origin = request.headers.get("origin");
  const host = (request.headers.get("host") ?? "").toLowerCase();

  if (origin) {
    const originHost = originToHost(origin);
    if (!originHost) return "Origem de pedido inválida.";
    const allowed = envOrigins();
    const sameHost = Boolean(host) && originHost === host;
    const allowedEnv = allowed.includes(originHost);
    if (!sameHost && !allowedEnv) {
      return "Origem de pedido não autorizada.";
    }
    return null;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "none" && fetchSite !== "same-origin") {
    return "Origem de pedido não autorizada.";
  }

  return null;
}

export function csrfFailure(): Response {
  return Response.json({ ok: false, error: "Origem de pedido não autorizada." }, { status: 403 });
}