import type { Metadata } from "next";
import type { ReactNode } from "react";
import { seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Entrar — IDesign Moz",
  description:
    "Aceda à sua área de cliente para gerir domínios, alojamento, email e facturação.",
  path: "/login",
  noindex: true,
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}