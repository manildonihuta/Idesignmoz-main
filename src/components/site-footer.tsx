import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/ui/core";
import { getSiteSettings } from "@/lib/site-settings";
import { getServices } from "@/lib/content";

interface SiteFooterProps {
  anchors?: boolean;
}

const MENU_ORDER: Array<{ category: string; service: string }> = [
  { category: "Web", service: "web-development" },
  { category: "Branding", service: "branding" },
  { category: "SEO", service: "seo" },
  { category: "Marketing", service: "digital-marketing" },
  { category: "Software", service: "software-development" },
  { category: "Design", service: "branding" },
];

export async function SiteFooter({ anchors = false }: SiteFooterProps) {
  const [settings, services] = await Promise.all([getSiteSettings(), getServices()]);

  const byCategory = new Map<string, typeof services>();
  for (const service of services) {
    const list = byCategory.get(service.category) ?? [];
    list.push(service);
    byCategory.set(service.category, list);
  }

  const serviceLinks = MENU_ORDER.map(({ category, service }) => {
    const match = services.find((s) => s.slug === service) ?? byCategory.get(category)?.[0];
    if (!match) return null;
    return { label: match.title ?? match.name, href: `/services/${match.slug}` };
  }).filter(Boolean) as Array<{ label: string; href: string }>;

  const whatsappNumber = settings.whatsapp.phoneNumber.replace(/[^\d]/g, "");

  return (
    <Footer
      brand={
        <Link className="logo" href={anchors ? "#top" : "/"}>
          <Image src="/logo.png" alt="IDesign Moz" width={2065} height={762} sizes="140px" />
        </Link>
      }
      tagline={settings.general.tagline || "Digital solutions for modern businesses."}
      columns={[
        {
          title: "Services",
          links: serviceLinks,
        },
        {
          title: "Domains",
          links: [
            { label: "Domain Search", href: "/domains/search" },
            { label: "Domain Pricing", href: "/domains" },
            { label: "Transfer", href: "/contact" },
          ],
        },
        {
          title: "Hosting",
          links: [
            { label: "Shared", href: "/hosting/shared-starter" },
            { label: "Business", href: "/hosting/shared-business" },
            { label: "WordPress", href: "/hosting/wp-starter" },
            { label: "VPS", href: "/hosting/vps-2" },
          ],
        },
        {
          title: "Company",
          links: [
            { label: "About", href: "/about" },
            { label: "Portfolio", href: "/portfolio" },
            { label: "Blog", href: "/blog" },
            { label: "Contact", href: "/contact" },
          ],
        },
        {
          title: "Support",
          links: [
            { label: "Help Center", href: "/contact" },
            { label: "Tickets", href: "/dashboard/tickets" },
            { label: "WhatsApp", href: `https://wa.me/${whatsappNumber}` },
          ],
        },
        {
          title: "Legal",
          links: [
            { label: "Terms", href: "/terms" },
            { label: "Privacy", href: "/privacy" },
            { label: "Refund Policy", href: "/refund-policy" },
          ],
        },
      ]}
      legal="© IDesign Moz"
    />
  );
}