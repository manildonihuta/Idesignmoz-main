import HostingSslView from "@/components/hosting/hosting-ssl-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SSL · Alojamento · IDesign Moz",
};

export default async function HostingSslPage({ params }: { params: Promise<{ hostingId: string }> }) {
  const { hostingId } = await params;
  return <HostingSslView hostingId={hostingId} />;
}