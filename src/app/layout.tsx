import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Mono, DM_Sans } from "next/font/google";
import { JsonLd } from "@/components/json-ld";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageTracking } from "@/components/page-tracking";
import { DEFAULT_KEYWORDS, organizationSchema, webSiteSchema } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const dmSans = DM_Sans({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-dmsans",
  display: "swap",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dmmono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "IDesign Moz — Create. Launch. Grow.",
  description: "Soluções digitais para negócios modernos em Moçambique e além-fronteiras.",
  keywords: DEFAULT_KEYWORDS,
  openGraph: {
    type: "website",
    title: "IDesign Moz — Create. Launch. Grow.",
    description: "Soluções digitais para negócios modernos em Moçambique e além-fronteiras.",
    siteName: "IDesign Moz",
    locale: "pt_MZ",
    images: [{ url: "/icon.png" }],
  },
  twitter: {
    card: "summary",
    title: "IDesign Moz — Create. Launch. Grow.",
    description: "Soluções digitais para negócios modernos em Moçambique e além-fronteiras.",
    images: ["/icon.png"],
  },
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-MZ"
      suppressHydrationWarning
      className={`${dmSans.variable} ${dmMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("idesign-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <a href="#main" className="skip-link">Pular para o conteúdo</a>
        {children}
        <ThemeToggle />
        <PageTracking />
        <JsonLd data={[organizationSchema(), webSiteSchema()]} />
      </body>
    </html>
  );
}
