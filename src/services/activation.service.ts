import "server-only";

import { processActivationJobs, type ActivationSummary } from "@/lib/activation";
import { fail, type ServiceResult } from "@/services/result";

export type { ActivationSummary } from "@/lib/activation";

/** Runs the provisioning queue. Called by the cron route. */
export async function runActivationPipeline(
  limit = 20,
): Promise<ServiceResult<ActivationSummary>> {
  try {
    const summary = await processActivationJobs(limit);
    return { ok: true, ...summary };
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : "Falha ao processar ativações.");
  }
}