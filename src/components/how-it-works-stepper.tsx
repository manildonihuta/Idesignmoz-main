"use client";

import Link from "next/link";
import ReactBitsStepper, { Step } from "@/components/ui/react-bits-stepper";
import { Search, Server, ShoppingBag, LayoutDashboard, ArrowUpRight } from "lucide-react";

const stepsData = [
  {
    stepNumber: "01",
    title: "Search Domain",
    subtitle: "Pesquisar & Reservar Domínio",
    text: "Encontre o endereço perfeito para a sua marca com registo instantâneo e preços transparentes por extensão (.co.mz, .com, .net).",
    href: "/domains/search",
    cta: "Procurar domínio",
    icon: Search,
  },
  {
    stepNumber: "02",
    title: "Choose Hosting",
    subtitle: "Alojamento & Servidores de Alta Performance",
    text: "Escolha o plano ideal com armazenamento SSD NVMe, certificados SSL gratuitos e backups automáticos diários.",
    href: "/hosting",
    cta: "Ver planos",
    icon: Server,
  },
  {
    stepNumber: "03",
    title: "Buy Services",
    subtitle: "Serviços Digitais & Criador de Sites com IA",
    text: "Adicione pacotes de websites profissionais, identidade visual, email empresarial ou crie o seu site em 1 minuto com IA.",
    href: "/services",
    cta: "Explorar serviços",
    icon: ShoppingBag,
  },
  {
    stepNumber: "04",
    title: "Manage Everything",
    subtitle: "Painel Unificado de Gestão",
    text: "Controle as suas faturas, domínios, contas de alojamento e tickets de suporte numa única plataforma simples e rápida.",
    href: "/dashboard",
    cta: "Abrir painel",
    icon: LayoutDashboard,
  },
];

export function HowItWorksStepper() {
  return (
    <div className="w-full py-2">
      <ReactBitsStepper
        initialStep={1}
        backButtonText="Anterior"
        nextButtonText="Próximo Passo"
        accentColor="var(--lime, #5227ff)"
        stepCircleContainerClassName="border border-white/10 bg-[#121316] shadow-[0_0_35px_rgba(0,0,0,0.5)]"
      >
        {stepsData.map((step) => {
          const Icon = step.icon;
          return (
            <Step key={step.stepNumber}>
              <div className="flex flex-col gap-3 py-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime/10 border border-lime/20 text-lime">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-lime">
                      Passo {step.stepNumber}
                    </span>
                    <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                      {step.title}
                    </h3>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-white/70 max-w-xl">
                  {step.text}
                </p>

                <div className="pt-2">
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-2 rounded-xl border border-lime/30 bg-lime/10 px-4 py-2 text-xs font-semibold text-lime hover:bg-lime hover:text-black transition-all group"
                  >
                    <span>{step.cta}</span>
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              </div>
            </Step>
          );
        })}
      </ReactBitsStepper>
    </div>
  );
}
