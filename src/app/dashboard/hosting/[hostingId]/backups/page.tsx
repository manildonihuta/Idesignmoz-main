import HostingBackupsView from "@/components/hosting/hosting-backups-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backups · Alojamento · IDesign Moz",
};

export default async function HostingBackupsPage({ params }: { params: Promise<{ hostingId: string }> }) {
  const { hostingId } = await params;
  return <HostingBackupsView hostingId={hostingId} />;
}