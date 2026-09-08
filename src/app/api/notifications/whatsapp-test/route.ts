import { NextRequest } from "next/server";
import { requireRolesRoute } from "@/lib/admin";
import { STAFF_ROLES } from "@/lib/security/rbac";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import {
  EXPERIMENTAL_WHATSAPP_EVENTS,
  isWhatsAppConfigured,
  normalizeWhatsAppNumber,
  sendWhatsAppTemplate,
  WA_TEMPLATES,
} from "@/lib/notifications/whatsapp";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requireRolesRoute(STAFF_ROLES);
  if (guard.response) return guard.response;

  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "notifications:whatsapp-test",
    limit: 10,
    windowSec: 60,
    ip: clientIp(request),
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: { phone?: string; kind?: string };
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:notifications/whatsapp-test", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  if (!isWhatsAppConfigured()) {
    return Response.json({ ok: false, error: "WhatsApp não configurado. Define WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_ID." }, { status: 501 });
  }

  const phone = body?.phone ?? "";
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized) {
    return Response.json({ ok: false, error: "Número de WhatsApp inválido (ex.: 258841234567)." }, { status: 400 });
  }

  const kind = body?.kind ?? "domain.registered";
  const template = WA_TEMPLATES[kind];
  if (!template) {
    return Response.json(
      { ok: false, error: `Evento sem template WhatsApp. Permitidos: ${EXPERIMENTAL_WHATSAPP_EVENTS.join(", ")}.` },
      { status: 400 },
    );
  }

  const meta = defaultPayloadFor(kind);
  const result = await sendWhatsAppTemplate(normalized, {
    name: template.name,
    language: template.language,
    params: template.params(meta),
  });

  return Response.json({ ...result, ok: result.ok, to: normalized, template: template.name });
}

function defaultPayloadFor(kind: string): Record<string, unknown> {
  switch (kind) {
    case "hosting.activated":
      return { domain: "exemplo.co.mz", planName: "Profissional" };
    case "invoice.created":
      return { number: "FT-2026-0001" };
    case "project.approved":
      return { title: "Site corporativo" };
    default:
      return { fullDomain: "exemplo.co.mz" };
  }
}