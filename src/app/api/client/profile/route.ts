import { NextRequest } from "next/server";

import { requireClientRoute } from "@/lib/client";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { serverLogError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireClientRoute();
  if (guard.response) return guard.response;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return Response.json({
    ok: true,
    profile: {
      name: meta.name ?? meta.full_name ?? "",
      phone: meta.phone ?? "",
      company: meta.company ?? "",
      nuit: meta.nuit ?? "",
      address: meta.address ?? "",
      city: meta.city ?? "",
    },
  });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireClientRoute();
  if (guard.response) return guard.response;

  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, {
    prefix: "client-profile",
    limit: 10,
    windowSec: 60,
    ip,
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch (e) {
    serverLogError("api:client/profile", e);
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const key of ["name", "phone", "company", "nuit", "address", "city"] as const) {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    data[key as string] = value;
  }
  if (typeof body.email === "string" && body.email.trim()) {
    data.email = body.email.trim();
  }

  const supabase = await createSupabaseServerClient();
  const { data: updated, error: updateError } = await supabase.auth.updateUser({ data });

  if (updateError) {
    return Response.json({ ok: false, error: updateError.message }, { status: 400 });
  }

  const meta = (updated?.user?.user_metadata ?? {}) as Record<string, unknown>;
  return Response.json({
    ok: true,
    email: updated?.user?.email ?? undefined,
    profile: {
      name: meta.name ?? meta.full_name ?? "",
      phone: meta.phone ?? "",
      company: meta.company ?? "",
      nuit: meta.nuit ?? "",
      address: meta.address ?? "",
      city: meta.city ?? "",
    },
  });
}
