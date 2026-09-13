"use client";

import { useState } from "react";
import { Briefcase, Heart, LayoutGrid, Palette, PenLine, Zap } from "lucide-react";

import {
  AIAssistantInterface,
  type AssistantCategory,
  type AssistantToggle,
} from "@/components/ui/ai-assistant-interface";
import type { ParsedSection } from "@/lib/ai/builder-schema";

const CATEGORIES: AssistantCategory[] = [
  {
    id: "sections",
    label: "Secções",
    icon: <LayoutGrid size={16} />,
    panelTitle: "Adicionar uma secção",
    items: [
      "Adiciona uma secção de FAQ à página",
      "Adiciona uma secção de serviços no fim da página",
      "Adiciona uma galeria de fotografias",
      "Adiciona uma secção de testemunhos",
      "Adiciona uma secção de estatísticas",
      "Adiciona uma secção de contacto",
    ],
  },
  {
    id: "text",
    label: "Textos",
    icon: <PenLine size={16} />,
    panelTitle: "Sugestões de texto",
    items: [
      "Escreve um novo texto para a primeira secção",
      "Torna os textos da página mais profissionais",
      "Reescreve a secção de serviços num tom direto",
      "Faz o texto inicial mais curto e impactante",
      "Melhora a legenda da galeria",
    ],
  },
  {
    id: "style",
    label: "Estilo",
    icon: <Palette size={16} />,
    panelTitle: "Sugestões de estilo",
    items: [
      "Usa o vermelho #E31E24 como cor principal",
      "Usa o verde #22C55E como cor de destaque",
      "Muda a tipografia para o estilo display",
      "Ativa o modo escuro do site",
      "Torna o cabeçalho mais chamativo",
    ],
  },
];

const TONES: AssistantToggle[] = [
  { id: "pro", label: "Profissional", icon: <Briefcase size={13} />, hint: "Respostas e textos num tom profissional" },
  { id: "direct", label: "Direto", icon: <Zap size={13} />, hint: "Respostas e textos num tom direto e objetivo" },
  { id: "friendly", label: "Amigável", icon: <Heart size={13} />, hint: "Respostas e textos num tom amigável" },
];

const TONE_PREFIX: Record<string, string> = {
  pro: "num tom profissional",
  direct: "num tom direto e objetivo",
  friendly: "num tom amigável",
};

const GREETING =
  "Olá! Sou o assistente do seu editor. Peça-me para adicionar ou reescrever secções, mudar as cores ou a tipografia do site.";

type AssistantActionPayload =
  | { action: "addSection"; section: ParsedSection }
  | { action: "rewrite"; index: number; section: ParsedSection }
  | { action: "setTheme"; theme: Record<string, unknown> }
  | { action: "respond"; text: string };

export function Assistant({
  siteId,
  pageId,
  onAddSection,
  onRewriteSection,
  onSetTheme,
}: {
  siteId: string;
  pageId?: string;
  onAddSection: (section: ParsedSection) => void;
  onRewriteSection: (index: number, section: ParsedSection) => void;
  onSetTheme: (themePatch: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);

  async function handleSend(message: string, options: { toggles: string[] }) {
    const tones = options.toggles.map((id) => TONE_PREFIX[id]).filter(Boolean);
    const fullMessage = tones.length > 0 ? `${tones.join(" e ")} (${message})` : message;

    const res = await fetch(`/api/ai-builder/sites/${siteId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: fullMessage, pageId }),
    });
    const data = await res.json();
    if (!data.ok || !data.action) {
      return data.error ?? "Não consegui processar o pedido. Tente novamente.";
    }

    const action = data.action as AssistantActionPayload;
    switch (action.action) {
      case "addSection":
        onAddSection(action.section);
        return "Pronto! Adicionei a nova secção no fim da página.";
      case "rewrite":
        onRewriteSection(action.index, action.section);
        return "Secção reescrita. Veja como ficou na pré-visualização.";
      case "setTheme":
        onSetTheme(action.theme);
        return "Tema atualizado. As cores e a tipografia já foram aplicadas.";
      case "respond":
        return action.text;
      default:
        return "Não consegui processar o pedido. Tente reformular.";
    }
  }

  if (open) {
    return (
      <div className="ai-font fixed bottom-5 right-5 z-[70] h-[min(640px,calc(100dvh-32px))] w-[min(460px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[var(--ai-border-strong)] bg-[var(--ai-surface)] shadow-2xl">
        <AIAssistantInterface
          title="Assistente do site"
          subtitle="Adicione ou reescreva secções e altere cores e tipografia com instruções em português."
          placeholder="Ex.: adiciona uma secção de serviços"
          categories={CATEGORIES}
          toggles={TONES}
          initialMessages={[{ role: "assistant", text: GREETING }]}
          onClose={() => setOpen(false)}
          onSend={handleSend}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="ai-btn ai-gradient-anim fixed bottom-5 right-5 z-[70] h-14 w-14 !rounded-full !p-0 text-xl"
      onClick={() => setOpen(true)}
      aria-label="Abrir assistente IA"
    >
      🤖
    </button>
  );
}