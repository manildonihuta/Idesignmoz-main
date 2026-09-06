import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "swiper/css";

export const metadata: Metadata = {
  title: "IDesign Moz — Create. Launch. Grow.",
  description: "Soluções digitais para negócios modernos em Moçambique e além-fronteiras.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-MZ" suppressHydrationWarning><body>{children}</body></html>;
}
