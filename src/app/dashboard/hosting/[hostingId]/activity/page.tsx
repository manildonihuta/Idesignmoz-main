import HostingActivityView from "@/components/hosting/hosting-activity-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Atividade · Alojamento · IDesign Moz",
};

export default async function HostingActivityPage({ params }: { params: Promise<{ hostingId: string }> }) {
  const { hostingId } = await params;
  return <HostingActivityView hostingId={hostingId} />;
}