import HostingAdvancedView from "@/components/hosting/hosting-advanced-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Avançado · Alojamento · IDesign Moz",
};

export default async function HostingAdvancedPage({ params }: { params: Promise<{ hostingId: string }> }) {
  const { hostingId } = await params;
  return <HostingAdvancedView hostingId={hostingId} />;
}