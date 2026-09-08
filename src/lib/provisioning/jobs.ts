import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverLogError } from "@/lib/server-log";

/** Idempotent claim of a pending job — only one worker may pick it up. */
export type ProvisioningJob = {
  id: string;
  order_id: string;
  kind: "hosting" | "domain";
  ref_id: string;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  run_after: string;
};

export async function enqueueProvisioningJob(
  orderId: string,
  kind: "hosting" | "domain",
  refId: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin.from("provisioning_jobs").insert({
    order_id: orderId,
    kind,
    ref_id: refId,
  });
  if (error) {
    serverLogError("provisioning:enqueue", error);
    return false;
  }
  return true;
}

export async function listOpenJobs(limit = 25): Promise<ProvisioningJob[]> {
  const { data, error } = await supabaseAdmin
    .from("provisioning_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("run_after", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    serverLogError("provisioning:listOpen", error);
    return [];
  }
  return (data ?? []) as ProvisioningJob[];
}

/** Atomically mark a job as running; returns the job if the claim succeeded. */
export async function claimJob(
  id: string,
  attempts: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("provisioning_jobs")
    .update({ status: "running", attempts: attempts + 1, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error || !data || data.length === 0) {
    return false;
  }
  return true;
}

export async function markJobDone(id: string, orderId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("provisioning_jobs")
    .update({ status: "done", done_at: now, last_error: null, updated_at: now })
    .eq("id", id);
  if (error) {
    serverLogError("provisioning:markDone", error);
  }
  await recomputeOrderStatus(orderId);
}

export async function markJobFailed(id: string, orderId: string, errorMessage: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("provisioning_jobs")
    .select("attempts, max_attempts")
    .eq("id", id)
    .maybeSingle();

  const attempts = Number(data?.attempts ?? 0);
  const maxAttempts = Number(data?.max_attempts ?? 5);
  const terminal = attempts >= maxAttempts;
  const now = new Date();

  if (terminal) {
    await supabaseAdmin
      .from("provisioning_jobs")
      .update({ status: "failed", last_error: errorMessage, updated_at: now.toISOString() })
      .eq("id", id);
    await recomputeOrderStatus(orderId);
    return;
  }

  const backoffMs = Math.min(attempts, 6) * 2 * 60 * 1000; // 2 min per attempt, capped at 12 min
  const runAfter = new Date(now.getTime() + backoffMs).toISOString();
  await supabaseAdmin
    .from("provisioning_jobs")
    .update({ status: "pending", last_error: errorMessage, run_after: runAfter, updated_at: now.toISOString() })
    .eq("id", id);
}

/**
 * Reflect truth back onto the order: paid/processing → completed once every
 * provisioning job for the order is done. Orders without jobs (e.g. plain
 * services) are treated as complete. A permanently failed job keeps the order
 * visible as 'processing' so staff can intervene.
 */
export async function recomputeOrderStatus(orderId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("provisioning_jobs")
    .select("status")
    .eq("order_id", orderId);
  if (error) return;

  if (!data || data.length === 0) return;
  const allDone = (data ?? []).every((job) => job.status === "done");
  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ status: allDone ? "completed" : "processing", updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (updateError) {
    serverLogError("provisioning:recomputeOrderStatus", updateError);
  }
}