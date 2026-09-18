"use client";

import { Steps } from "@ark-ui/react/steps";
import { Check } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

export type StepItem = {
  title: string;
  description?: string;
  content?: React.ReactNode;
};

export type StepsProps = {
  steps?: StepItem[];
  count?: number;
  defaultStep?: number;
  step?: number;
  onStepChange?: (details: { step: number }) => void;
  className?: string;
};

export default function BasicSteps({ count = 4, defaultStep = 1, className }: StepsProps) {
  const stepsList = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <div className={cn("bg-surface border border-line w-full px-4 py-8 rounded-xl flex items-center justify-center", className)}>
      <Steps.Root count={count} defaultStep={defaultStep} className="w-full max-w-2xl">
        <Steps.List className="flex justify-between items-center">
          {stepsList.map((stepNum, index) => (
            <Steps.Item
              key={stepNum}
              index={index}
              className="relative flex not-last:flex-1 items-center"
            >
              <Steps.Trigger className="flex items-center gap-3 text-left rounded-md">
                <Steps.Indicator className="flex justify-center items-center shrink-0 rounded-full font-semibold w-8 h-8 text-sm border-2 data-[state=closed]:bg-surface-2 data-complete:bg-brand data-complete:text-white data-complete:border-brand data-current:bg-brand data-current:text-white data-current:border-brand data-incomplete:bg-surface-2 data-incomplete:text-muted data-incomplete:border-line">
                  {stepNum}
                </Steps.Indicator>
              </Steps.Trigger>
              <Steps.Separator
                hidden={index === stepsList.length - 1}
                className="flex-1 bg-line h-0.5 mx-3 data-complete:bg-brand"
              />
            </Steps.Item>
          ))}
        </Steps.List>
      </Steps.Root>
    </div>
  );
}

export function CustomSteps({
  steps = [
    {
      title: "Identificação do Nome",
      description: "Pesquise e selecione o domínio ideal para o seu negócio.",
    },
    {
      title: "Configuração & Breve",
      description: "Escolha o plano de alojamento e preencha os detalhes iniciais.",
    },
    {
      title: "Ativação & Publicação",
      description: "Ativação instantânea com certificado SSL e painel de controlo.",
    },
  ],
  defaultStep = 0,
  className,
}: {
  steps?: StepItem[];
  defaultStep?: number;
  className?: string;
}) {
  return (
    <div className={cn("bg-surface border border-line w-full px-6 py-10 rounded-2xl flex items-center justify-center shadow-xl", className)}>
      <Steps.Root count={steps.length} defaultStep={defaultStep} className="w-full max-w-3xl">
        <Steps.List className="flex justify-between items-start gap-2">
          {steps.map((step, index) => (
            <Steps.Item
              key={index}
              index={index}
              className="relative flex not-last:flex-1 items-center"
            >
              <Steps.Trigger className="flex items-center gap-3 text-left rounded-md group">
                <Steps.Indicator className="flex justify-center items-center shrink-0 rounded-full font-semibold w-9 h-9 text-sm border-2 transition-all duration-300 data-complete:bg-brand data-complete:text-white data-complete:border-brand data-current:bg-brand data-current:text-white data-current:border-brand data-incomplete:bg-surface-2 data-incomplete:text-muted data-incomplete:border-line relative">
                  <span className="group-data-complete:hidden group-data-current:block">
                    {index + 1}
                  </span>
                  <Check className="w-4 h-4 group-data-complete:block hidden" />
                </Steps.Indicator>
                <div className="hidden sm:flex flex-col">
                  <span className="text-sm font-semibold text-paper leading-none">
                    {step.title}
                  </span>
                  {step.description && (
                    <span className="text-xs text-muted mt-1 leading-tight max-w-[140px]">
                      {step.description}
                    </span>
                  )}
                </div>
              </Steps.Trigger>
              <Steps.Separator
                hidden={index === steps.length - 1}
                className="flex-1 bg-line h-0.5 mx-3 data-complete:bg-brand transition-colors duration-300"
              />
            </Steps.Item>
          ))}
        </Steps.List>

        <div className="mt-8 p-6 bg-surface-2 border border-line rounded-xl">
          {steps.map((step, index) => (
            <Steps.Item key={index} index={index}>
              <Steps.Content index={index} className="text-paper text-sm leading-relaxed">
                {step.content || step.description}
              </Steps.Content>
            </Steps.Item>
          ))}

          <Steps.CompletedContent className="text-center p-6 text-ok">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-ok/10 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-ok" />
              </div>
              <h3 className="text-lg font-semibold text-paper">
                Processo Concluído!
              </h3>
              <p className="text-sm text-muted">
                O seu serviço está pronto para ser ativado e utilizado imediatamente.
              </p>
            </div>
          </Steps.CompletedContent>
        </div>

        <div className="flex justify-between items-center mt-6">
          <Steps.PrevTrigger className="px-4 py-2 text-sm font-medium text-paper bg-surface-2 border border-line rounded-lg hover:border-brand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Anterior
          </Steps.PrevTrigger>
          <Steps.NextTrigger className="px-5 py-2 text-sm font-medium text-white bg-brand border border-brand rounded-lg hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Continuar
          </Steps.NextTrigger>
        </div>
      </Steps.Root>
    </div>
  );
}

export { BasicSteps };
