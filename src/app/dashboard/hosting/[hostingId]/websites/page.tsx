import HostingWebsitesView from "@/components/hosting/hosting-websites-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sites · Alojamento · IDesign Moz",
};

export default async function HostingWebsitesPage({ params }: { params: Promise<{ hostingId: string }> }) {
  const { hostingId } = await params;
  return <HostingWebsitesView hostingId={hostingId} />;
}