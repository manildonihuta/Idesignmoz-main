import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AuthContext = {
  authenticated: boolean;
  userId?: string;
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  nuit?: string;
  address?: string;
  city?: string;
};

export async function getClientContext(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { authenticated: false };
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    authenticated: true,
    userId: user.id,
    email: user.email ?? undefined,
    name: (meta.name as string) || (meta.full_name as string) || undefined,
    phone: (meta.phone as string) || undefined,
    company: (meta.company as string) || undefined,
    nuit: (meta.nuit as string) || undefined,
    address: (meta.address as string) || undefined,
    city: (meta.city as string) || undefined,
  };
}

export async function requireClientRoute() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) {
    return {
      response: Response.json({ ok: false, error: "Não autenticado." }, { status: 401 }),
      ctx: null as AuthContext | null,
    };
  }
  return { response: null, ctx };
}