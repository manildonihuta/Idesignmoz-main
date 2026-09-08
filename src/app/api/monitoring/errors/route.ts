import { NextRequest } from "next/server";
import { serverLogError } from "@/lib/server-log";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BODY = 8192;
const MAX_FIELD = 4000;

type ReportBody = {
  url?: string;
  digest?: string;
  message?: string;
  stack?: string;
};

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { prefix: "monitoring", limit: 30, windowSec: 60, ip });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return Response.json({ ok: false, error: "Relatório demasiado grande." }, { status: 413 });
  }

  let body: ReportBody;
  try {
    body = JSON.parse(raw) as ReportBody;
  } catch {
    return Response.json({ ok: false, error: "Relatório inválido." }, { status: 400 });
  }

  const clip = (value: unknown): string => (typeof value === "string" ? value.slice(0, MAX_FIELD) : "");

  serverLogError("client:page", new Error(clip(body.message) || "Client-side error"), {
    url: clip(body.url),
    digest: clip(body.digest),
    stack: clip(body.stack),
    ip,
  });

  return Response.json({ ok: true });
}