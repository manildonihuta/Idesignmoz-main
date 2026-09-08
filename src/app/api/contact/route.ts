import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { contactSchema } from "@/lib/schemas";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { logAudit, AUDIT } from "@/lib/security/audit";
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

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Campos inválidos." },
      { status: 400 },
    );
  }

  const { name, email, service, message } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("contact_messages")
    .insert({ name, email, service, message })
    .select()
    .single();

  if (error) {
    serverLogError("api:contact", error);
    return Response.json({ ok: false, error: "Não foi possível enviar o pedido." }, { status: 500 });
  }

  await logAudit({
    action: AUDIT.CONTACT_CREATED,
    entity: "contact_message",
    entityId: data?.id,
    actorEmail: email,
    ip,
    meta: { service },
  });

  return Response.json({ ok: true, message: data });
}
