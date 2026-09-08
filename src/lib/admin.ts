import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AdminMessage, AdminOrder, AdminDomain, AdminProfile, AdminSubscription } from "@/components/ui/admin/types";
import { normalizeRole, permissionsForRole, hasPermission, type Permission, type Role } from "@/lib/security/rbac";

export type AdminContext = {
  authenticated: boolean;
  isAdmin: boolean;
  role: Role;
  permissions: Permission[];
  userId?: string;
  email?: string;
};

export type AdminDashboard = {
  messages: AdminMessage[];
  orders: AdminOrder[];
  domains: AdminDomain[];
  profiles: AdminProfile[];
  emailByUserId: Record<string, string>;
  subscriptions: AdminSubscription[];
};

/** List the latest subscriptions with customer identity and plan name resolved. */
export async function listAdminSubscriptions(): Promise<AdminSubscription[]> {
  const [subs, plans, profiles] = await Promise.all([
    supabaseAdmin.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("hosting_plans").select("id, name"),
    supabaseAdmin.from("profiles").select("id, full_name"),
  ]);

  const planNameById = new Map((plans.data ?? []).map((p) => [p.id, p.name]));
  const nameByUserId = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers().catch(() => ({ data: { users: [] } }));
  const emailByUserId: Record<string, string> = {};
  authUsers?.users?.forEach((u) => u.email && (emailByUserId[u.id] = u.email));

  return (subs.data ?? []).map((s) => ({
    id: s.id,
    customer_id: s.customer_id ?? null,
    customer_email: s.customer_id ? emailByUserId[s.customer_id] ?? null : null,
    customer_name: s.customer_id ? nameByUserId.get(s.customer_id) ?? null : null,
    kind: s.kind,
    plan_id: s.plan_id ?? null,
    plan_name: s.plan_id ? planNameById.get(s.plan_id) ?? null : null,
    period: s.period,
    price: Number(s.price ?? 0),
    currency: s.currency ?? "MZN",
    status: s.status,
    starts_at: s.starts_at,
    renews_at: s.renews_at,
    auto_renew: s.auto_renew ?? true,
    payment_method: s.payment_method,
    past_due_since: s.past_due_since,
    suspended_since: s.suspended_since,
    created_at: s.created_at,
  }));
}

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const [
    { data: messages },
    { data: orders },
    { data: domains },
    { data: profiles },
    { data: authUsers },
    subscriptions,
  ] = await Promise.all([
    supabaseAdmin.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("domain_orders").select("*").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("domains").select("*").order("checked_at", { ascending: false }).limit(100),
    supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.auth.admin.listUsers().catch(() => ({ data: { users: [] } })),
    listAdminSubscriptions(),
  ]);

  const emailByUserId: Record<string, string> = {};
  authUsers?.users?.forEach((u) => u.email && (emailByUserId[u.id] = u.email));

  return {
    messages: messages ?? [],
    orders: orders ?? [],
    domains: domains ?? [],
    profiles: profiles ?? [],
    emailByUserId,
    subscriptions,
  };
}

export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false, isAdmin: false, role: "customer", permissions: [] };
  }

  // Resolve the role from the profiles table (server-side, bypasses RLS).
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = normalizeRole(profile?.role);
  const rolePermissions = permissionsForRole(role);

  const isAdmin = role === "super_admin" || role === "admin";

  return {
    authenticated: true,
    isAdmin,
    role,
    permissions: rolePermissions,
    userId: user.id,
    email: user.email,
  };
}

export type GuardResult =
  | { response: Response; ctx?: never }
  | { response: null; ctx: AdminContext };

/** Protects API route handlers: returns a JSON error response when not allowed. */
export async function requireAdminRoute(): Promise<GuardResult> {
  const ctx = await getAdminContext();
  if (!ctx.authenticated) {
    return { response: Response.json({ ok: false, error: "Não autenticado." }, { status: 401 }) };
  }
  if (!ctx.isAdmin) {
    return { response: Response.json({ ok: false, error: "Acesso restrito a administradores." }, { status: 403 }) };
  }
  return { response: null, ctx };
}

/** Protects API route handlers by permission (RBAC based on the profiles.role). */
export async function requirePermissionRoute(permission: Permission): Promise<GuardResult> {
  const ctx = await getAdminContext();
  if (!ctx.authenticated) {
    return { response: Response.json({ ok: false, error: "Não autenticado." }, { status: 401 }) };
  }
  if (!hasPermission(ctx.role, permission)) {
    return { response: Response.json({ ok: false, error: "Acesso restrito." }, { status: 403 }) };
  }
  return { response: null, ctx };
}

/** Protects API route handlers by explicit role list. */
export async function requireRolesRoute(roles: readonly Role[]): Promise<GuardResult> {
  const ctx = await getAdminContext();
  if (!ctx.authenticated) {
    return { response: Response.json({ ok: false, error: "Não autenticado." }, { status: 401 }) };
  }
  if (!roles.includes(ctx.role)) {
    return { response: Response.json({ ok: false, error: "Acesso restrito." }, { status: 403 }) };
  }
  return { response: null, ctx };
}
