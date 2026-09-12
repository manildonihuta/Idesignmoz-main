import { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { csrfError, csrfFailure } from "@/lib/security/csrf";
import { applyRateLimit, rateLimitResponse, clientIp } from "@/lib/security/rate-limit";
import { createWebsiteBrief, type WebsiteBriefInput } from "@/services/proposal.service";

export const dynamic = "force-dynamic";

/** Public onboarding endpoint for the website journey:
 *  Brief → project (brief) + proposal (sent, linked) → client approves online. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const csrf = csrfError(request);
  if (csrf) return csrfFailure();

  const limited = await applyRateLimit(request, { prefix: "website-brief", limit: 8, windowSec: 300, ip });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: WebsiteBriefInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  const clientId = user?.id ?? null;

  const result = await createWebsiteBrief(body ?? {}, { clientId, ip });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json(
    { ok: true, proposalToken: result.proposalToken, projectId: result.projectId, proposalId: result.proposalId },
    { status: 200 },
  );
}