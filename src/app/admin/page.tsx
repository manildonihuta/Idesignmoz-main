import { redirect } from "next/navigation";
import DashboardWithCollapsibleSidebar from "@/components/ui/dashboard-with-collapsible-sidebar";
import { getAdminContext } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await getAdminContext();

  if (!ctx.authenticated) {
    redirect("/login");
  }
  if (!ctx.isAdmin) {
    redirect("/");
  }

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

  return (
    <DashboardWithCollapsibleSidebar
      adminEmail={ctx.email}
      messages={messages ?? []}
      orders={orders ?? []}
      domains={domains ?? []}
      profiles={profiles ?? []}
      emailByUserId={emailByUserId}
    />
  );
}
