import HostingPerformanceView from "@/components/hosting/hosting-performance-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Desempenho · Alojamento · IDesign Moz",
};

export default async function HostingPerformancePage({ params }: { params: Promise<{ hostingId: string }> }) {
  const { hostingId } = await params;
  return <HostingPerformanceView hostingId={hostingId} />;
}