import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AdminContext = {
  authenticated: boolean;
  isAdmin: boolean;
  userId?: string;
  email?: string;
};

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
