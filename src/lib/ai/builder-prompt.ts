import "server-only";
import { LIMITS } from "./builder-schema";

export type SiteBrief = {
  businessName: string;
  industry?: string | null;
  domain?: string | null;
  tagline?: string;
  brief: string;
  primaryColor?: string;
  accentColor?: string;
  colorPreference?: "auto" | "brand" | "custom";
  style?: string;
  typography?: "sans" | "display" | "mono";
};

export const AI_BRAND_COLOR = "#E31E24";

export const STYLE_GUIDANCE: Record<string, string> = {
  modern:
    "Estilo MODERNO: design limpo, muito espaço em branco, tipografia forte, cantos arredondados e gradientes subtis nos destaques.",
  minimal:
    "Estilo MINIMALISTA: paleta contida, abundância de espaço em branco, tipografia elegante e nenhuma decoração supérflua.",
  bold:
    "Estilo ARROJADO: cores fortes, contraste alto, tipografia grande e expressiva, secções marcantes e orientadas a ação.",
  elegant:
    "Estilo ELEGANTE: paleta sóbria, linhas finas, espaçamento generoso e sentido de premium.",
  playful:
    "Estilo DIVERTIDO: cores vivas, cantos arredondados, tom informal e acolhedor, ideal para marcas jovens.",
};

const SECTION_SCHEMA = `
- "hero": { type, headline, subheadline?, cta?: { label, href? }, align?: "left"|"center" }
- "about": { type, heading?, body, bullets?: string[] }
- "features": { type, heading?, intro?, items: [{ title, text }] }
- "services": { type, heading?, intro?, items: [{ name, description?, price_mt? }] }  // price_mt só se o brief indicar preços
- "gallery": { type, heading?, items: [{ label, caption? }] }
- "stats": { type, heading?, items: [{ value, label }] }
- "testimonials": { type, heading?, items: [{ quote, author, role? }] }
- "faq": { type, heading?, items: [{ q, a }] }
- "cta": { type, headline, sub?, button?: { label, href? } }
- "contact": { type, heading?, email?, phone?, address?, note? }
- "footer": { type, text?, links?: [{ label, href? }] }
- "text": { type, heading?, body }
`;

function systemBase(): string {
  return `És um copywriter e estratega de websites moçambicano. Escreves em português de Moçambique, com tom profissional e directo.
RESPONDE APENAS COM UM OBJECTO JSON VÁLIDO — sem markdown, sem texto fora do JSON.
NUNCA inventes preços (price_mt), contactos ou factos que não estejam no brief do cliente. Se o brief não os der, omite-os.
Não uses HTML. Textos limitados: headline ≤ 200 chars, body ≤ 2000, cada item ≤ 400.`;
}

/** Prompt para gerar o site completo a partir do brief. */
export function buildSitePrompt(brief: SiteBrief): { system: string; user: string } {
  const design = buildDesignGuidance(brief);
  const user = `Cria o website de "${brief.businessName}"${brief.industry ? ` (sector: ${brief.industry})` : ""}${
    brief.domain ? `, domínio ${brief.domain}` : ""
  }${brief.tagline ? `, slogan: "${brief.tagline}"` : ""}.

Brief do cliente:
"""${brief.brief.slice(0, 4000)}"""

${design}
Estrutura obrigatória — devolve JSON:
{
  "name": "",
  "tagline": "",
  "theme": { "primaryColor": "#hex", "accentColor": "#hex", "mode": "dark"|"light", "font": "sans"|"display"|"mono" },
  "seo": { "title": "", "description": "" },
  "pages": [ { "slug": "inicio", "title": "", "navLabel": "", "sections": [ ... ] } ]
}

Regras:
- 2 a ${LIMITS.pages} páginas; a primeira chama-se sempre slug "inicio".
- Página principal: 4 a ${LIMITS.sectionsPerPage} secções; páginas internas: 2 a 6.
- Começa a primeira página com uma secção "hero".
- Usa apenas estes tipos de secção (estrutura exacta):
${SECTION_SCHEMA}
- Gera copy real em português de Moçambique, específica do negócio (nada de lorem ipsum).
- Não coloques mais de ${LIMITS.itemsPerList} items em listas.`;
  return { system: systemBase(), user };
}

function buildDesignGuidance(brief: SiteBrief): string {
  const parts: string[] = [];
  const forcedColor = brief.colorPreference === "brand" ? AI_BRAND_COLOR : brief.primaryColor;
  if (forcedColor) parts.push(`Cor principal OBRIGATÓRIA: ${forcedColor}. Usa-a exatamente em "theme.primaryColor".`);
  if (brief.accentColor) parts.push(`Cor de destaque (accent): ${brief.accentColor}. Usa-a em "theme.accentColor" sempre que precisares de uma cor secundária.`);
  if (brief.typography) parts.push(`Tipografia OBRIGATÓRIA: "${brief.typography}". Usa exatamente este valor em "theme.font" e desenha o site com essa letra em mente.`);
  if (brief.style && STYLE_GUIDANCE[brief.style]) parts.push(STYLE_GUIDANCE[brief.style]);
  if (parts.length === 0) return "Design: escolhe por ti uma paleta e tipografia coerentes com o negócio.";
  return `--- Design ---\n${parts.join("\n")}`;
}

/** Prompt para reescrever uma única secção com base numa instrução. */
export function buildRewriteSectionPrompt(input: {
  businessName: string;
  brief: string;
  pageTitle: string;
  section: unknown;
  instruction: string;
}): { system: string; user: string } {
  const user = `Estamos a editar o site de "${input.businessName}".

Brief do cliente:
"""${input.brief.slice(0, 3000)}"""

Página: "${input.pageTitle}".

Secção actual (JSON):
${JSON.stringify(input.section)}

Instrução do cliente: "${input.instruction.slice(0, 500)}"

Devolve APENAS o JSON da secção reescrita, mantendo o mesmo "type" e a mesma estrutura do schema:
${SECTION_SCHEMA}
Não inventes preços nem contactos que não estejam no brief.`;
  return { system: systemBase(), user };
}

/** Tipos de ação que o assistente de edição pode devolver. */
export const ASSISTANT_ACTION_SCHEMA = `
Devolve APENAS UM OBJECTO JSON, escolhendo UMA destas quatro formas conforme o pedido do cliente:

1) O cliente PEDE PARA ADICIONAR uma secção nova à página:
   { "action": "addSection", "section": { "type": "...", ... } }

2) O cliente PEDE PARA MUDAR uma secção existente (usa o índice (0-based) certo da secção na lista fornecida):
   { "action": "rewrite", "index": N, "section": { "type": "...", ... } }

3) O cliente PEDE PARA MUDAR cores, modo ou tipografia do site:
   { "action": "setTheme", "theme": { "primaryColor"?: "#hex", "accentColor"?: "#hex", "mode"?: "dark"|"light", "font"?: "sans"|"display"|"mono" } }

4) Qualquer outro caso (perguntas, cumprimentos, pedidos fora do alcance ou que não permitam editar):
   { "action": "respond", "text": "resposta curta e útil em português de Moçambique" }`;

/** Prompt do assistente de edição (chat dentro do editor). */
export function buildAssistantPrompt(input: {
  businessName: string;
  brief: string;
  pageTitle: string;
  sections: unknown;
  message: string;
}): { system: string; user: string } {
  const system = `${systemBase()}
És o assistente de edição do IDesign AI Builder. Ajudas o cliente (em português de Moçambique) a editar o website dele.
${ASSISTANT_ACTION_SCHEMA}
Estrutura das secções:
${SECTION_SCHEMA}
Se pedirem algo como "adiciona uma secção de X", preenche a secção com copy real. Não inventes preços nem contactos que não estejam no brief do cliente.`;
  const user = `Site de "${input.businessName}".
Brief do cliente:
"""${input.brief.slice(0, 3000)}"""

Página atual: "${input.pageTitle}".
Secções da página atual (JSON — os índices são 0-based na ordem da lista):
"""
${JSON.stringify(input.sections).slice(0, 12000)}
"""

Mensagem do cliente: "${input.message.slice(0, 600)}"

Responde apenas com o JSON da ação.`;
  return { system, user };
}