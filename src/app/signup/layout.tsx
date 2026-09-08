import type { Metadata } from "next";
import type { ReactNode } from "react";
import { seo } from "@/lib/seo";

export const metadata: Metadata = seo({
  title: "Criar conta — IDesign Moz",
  description:
    "Crie a sua área de cliente para gerir domínios, alojamento, email e facturação.",
  path: "/signup",
  noindex: true,
});

export default function SignupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}