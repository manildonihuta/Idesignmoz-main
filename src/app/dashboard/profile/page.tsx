import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileView } from "@/components/profile-view";
import { getClientContext } from "@/lib/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfil — Área de cliente",
};

export default async function DashboardProfilePage() {
  const ctx = await getClientContext();
  if (!ctx.authenticated) redirect("/login");

  return (
    <DashboardShell user={ctx}>
      <ProfileView
        initial={{
          fullName: ctx.name ?? "",
          email: ctx.email ?? "",
          phone: ctx.phone ?? "",
          company: ctx.company ?? "",
          nuit: ctx.nuit ?? "",
          address: ctx.address ?? "",
          city: ctx.city ?? "",
        }}
      />
    </DashboardShell>
  );
}
