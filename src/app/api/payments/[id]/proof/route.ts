import { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";
import { uploadPaymentProof } from "@/services/money.service";

export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "payment-proof",
    limit: 10,
    windowSec: 3600,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    return Response.json({ ok: false, error: "Pagamento inválido." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    serverLogError("api:payments/proof", e);
    return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: "Seleciona o comprovativo (imagem ou PDF)." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ ok: false, error: "O comprovativo é demasiado grande (máx. 5 MB)." }, { status: 400 });
  }
  const mime = String(file.type || "application/octet-stream");
  if (!/^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/i.test(mime)) {
    return Response.json({ ok: false, error: "Formato não suportado (PNG, JPG, WEBP ou PDF)." }, { status: 400 });
  }

  const notes = typeof form.get("notes") === "string" ? String(form.get("notes")).slice(0, 500) : undefined;

  const result = await uploadPaymentProof({
    customerId: user.id,
    paymentId: id,
    proof: {
      file: new Uint8Array(await file.arrayBuffer()),
      mime,
      fileName: file.name,
      notes,
    },
    actor: { userId: user.id, email: user.email ?? undefined },
  });

  return Response.json(result, { status: result.ok ? 200 : result.status });
}