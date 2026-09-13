import HostingSecurityView from "@/components/hosting/hosting-security-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Segurança · Alojamento · IDesign Moz",
};

export default async function HostingSecurityPage({ params }: { params: Promise<{ hostingId: string }> }) {
  const { hostingId } = await params;
  return <HostingSecurityView hostingId={hostingId} />;
}