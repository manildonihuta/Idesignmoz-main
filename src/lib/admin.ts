import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AdminMessage, AdminOrder, AdminDomain, AdminProfile } from "@/components/ui/admin/types";

export type AdminContext = {
  authenticated: boolean;
  isAdmin: boolean;
  userId?: string;
  email?: string;
};

export type AdminDashboard = {
  messages: AdminMessage[];
  orders: AdminOrder[];
  domains: AdminDomain[];
  profiles: AdminProfile[];
  emailByUserId: Record<string, string>;
};

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const [
    { data: messages },
    { data: orders },
    { data: domains },
    { data: profiles },
    { data: authUsers },
  ] = await Promise.all([
    supabaseAdmin.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("domain_orders").select("*").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("domains").select("*").order("checked_at", { ascending: false }).limit(100),
    supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.auth.admin.listUsers().catch(() => ({ data: { users: [] } })),
  ]);

  const emailByUserId: Record<string, string> = {};
  authUsers?.users?.forEach((u) => u.email && (emailByUserId[u.id] = u.email));

  return {
    messages: messages ?? [],
    orders: orders ?? [],
    domains: domains ?? [],
    profiles: profiles ?? [],
    emailByUserId,
  };
}

export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authenticated: false, isAdmin: false };

  // Resolve the role from the profiles table (server-side, bypasses RLS).
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  return {
    authenticated: true,
    isAdmin,
    userId: user.id,
    email: user.email,
  };
}

/** Protects API route handlers: returns a JSON error response when not allowed. */
export async function requireAdminRoute() {
  const ctx = await getAdminContext();
  if (!ctx.authenticated) {
    return { response: Response.json({ ok: false, error: "Não autenticado." }, { status: 401 }) };
  }
  if (!ctx.isAdmin) {
    return { response: Response.json({ ok: false, error: "Acesso restrito a administradores." }, { status: 403 }) };
  }
  return { response: null, ctx };
}
