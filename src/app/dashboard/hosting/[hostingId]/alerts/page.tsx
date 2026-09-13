import HostingAlertsView from "@/components/hosting/hosting-alerts-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alertas · Alojamento · IDesign Moz",
};

export default async function HostingAlertsPage({ params }: { params: Promise<{ hostingId: string }> }) {
  const { hostingId } = await params;
  return <HostingAlertsView hostingId={hostingId} />;
}