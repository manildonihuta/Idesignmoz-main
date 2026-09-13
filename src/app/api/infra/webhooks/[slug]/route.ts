import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";
import { logProviderActivity } from "@/lib/providers/activity";
import { recordInboundEvent, verifyWebhookSignature, inboundSecretForProvider } from "@/lib/providers/webhooks";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/;

/**
 * Inbound provider webhook endpoint: providers call /api/infra/webhooks/<slug>.
 * Verifies the HMAC-SHA256 signature with the provider's stored secret, applies
 * a timestamp replay window, and persists each delivery idempotently
 * (unique idempotency_key), deduplicating retries. Never logs the payload.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    if (!SLUG_RE.test(slug)) return Response.json({ ok: false, error: "Fornecedor desconhecido." }, { status: 404 });

    const { data: provider, error } = await supabaseAdmin.from("providers").select("id, name").eq("slug", slug).maybeSingle();
    if (error || !provider) return Response.json({ ok: false, error: "Fornecedor desconhecido." }, { status: 404 });

    const rawBody = await request.text();
    if (!rawBody) return Response.json({ ok: false, error: "Corpo vazio." }, { status: 400 });

    const secret = await inboundSecretForProvider(slug);
    const signature = request.headers.get("x-idesign-signature");
    if (secret) {
      const verified = verifyWebhookSignature(signature, rawBody, secret);
      if (!verified.ok) {
        const idempotencyKey = deliveryKey(request, rawBody, "rejected");
        await recordInboundEvent({
          providerId: provider.id as string,
          source: slug,
          event: "signature",
          payload: null,
          idempotencyKey,
          signatureVerified: false,
        });
        return Response.json({ ok: false, error: verified.reason ?? "Assinatura inválida." }, { status: 401 });
      }
    } else if (!signature) {
      // No endpoint secret configured for this provider: reject unless the
      // operator explicitly permits unsigned traffic (not supported).
      return Response.json({ ok: false, error: "Webhook sem segredo configurado." }, { status: 501 });
    }

    let payload: unknown = null;
    let event = "event";
    try {
      payload = JSON.parse(rawBody);
      if (payload && typeof payload === "object" && "type" in payload) {
        event = String((payload as { type: unknown }).type || event).slice(0, 120);
      }
    } catch {
      // Raw body kept intact for the signature check; payload stays null.
    }

    const result = await recordInboundEvent({
      providerId: provider.id as string,
      source: slug,
      event,
      payload,
      idempotencyKey: deliveryKey(request, rawBody, event),
      signatureVerified: Boolean(secret),
    });
    if (!result.ok) return Response.json({ ok: false, error: "Falha ao registar o webhook." }, { status: 500 });

    if (!result.duplicate) {
      await logProviderActivity({
        providerId: provider.id as string,
        event: "webhook.received",
        level: "info",
        message: `Evento recebido: ${event}.`,
        meta: { source: slug, event, verified: Boolean(secret) },
      });
    }
    return Response.json({ ok: true, id: result.eventId ?? null, duplicate: result.duplicate }, { status: 200 });
  } catch (error) {
    serverLogError("api:infra/webhooks", error);
    return Response.json({ ok: false, error: "Falha ao processar o webhook." }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  return Response.json({ ok: true, method: "POST", usage: "/api/infra/webhooks/<providerSlug>" }, { status: 200 });
}

/** Deterministic idempotency key: source + event + content digest (+ delivery id). */
function deliveryKey(request: NextRequest, rawBody: string, event: string): string {
  const deliveryId = request.headers.get("x-delivery-id") ?? request.headers.get("webhook-id");
  const digest = createHash("sha256").update(rawBody).digest("hex").slice(0, 24);
  return `${event}:${deliveryId ?? digest}`;
}