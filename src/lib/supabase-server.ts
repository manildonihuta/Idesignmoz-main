import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: options.sameSite === "strict" ? "strict" : "lax",
              secure: options.secure === true || process.env.NODE_ENV === "production",
              path: "/",
            }),
          );
        } catch {
          // Called from a Server Component; safe to ignore when middleware refresh is needed.
        }
      },
    },
  });
}
