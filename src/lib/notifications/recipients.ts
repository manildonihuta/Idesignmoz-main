import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Role } from "@/lib/security/rbac";
import type { NotifRecipient } from "./types";

/** Resolves staff recipients (profiles) for a set of allowed roles. */
export async function resolveStaffRecipients(roles: readonly Role[]): Promise<NotifRecipient[]> {
  if (!roles.length) return [];

  const { data } = await supabaseAdmin.from("profiles").select("id").in("role", [...roles]);
  if (!data?.length) return [];

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers().catch(() => ({ data: { users: [] } }));
  const emailBy = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  return data.map((p) => ({ userId: p.id, email: emailBy.get(p.id) || undefined }));
}

/** Resolves a single auth user email by profile/user id. */
export async function resolveUserEmail(userId: string): Promise<string | undefined> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId).catch(() => ({ data: { user: null } }));
  return data?.user?.email ?? undefined;
}