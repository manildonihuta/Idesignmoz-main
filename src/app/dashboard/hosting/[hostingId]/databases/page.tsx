import HostingDatabasesView from "@/components/hosting/hosting-databases-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bases de dados · Alojamento · IDesign Moz",
};

export default async function HostingDatabasesPage({ params }: { params: Promise<{ hostingId: string }> }) {
  const { hostingId } = await params;
  return <HostingDatabasesView hostingId={hostingId} />;
}