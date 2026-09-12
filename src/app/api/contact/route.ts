import { NextRequest } from "next/server";

import { submitContact } from "@/services/crm.service";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

const CONTACT_LIMIT = 5;
const CONTACT_WINDOW_SEC = 60;

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "contact",
    limit: CONTACT_LIMIT,
    windowSec: CONTACT_WINDOW_SEC,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:contact", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const result = await submitContact(body, ip);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });

  return Response.json({ ok: true, message: result.message });
}