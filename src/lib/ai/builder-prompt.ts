import "server-only";
import { LIMITS } from "./builder-schema";

export type SiteBrief = {
  businessName: string;
  industry?: string | null;
  domain?: string | null;
  tagline?: string;
  brief: string;
  primaryColor?: string;
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
  const theme = brief.primaryColor ? `Cor principal sugerida pelo cliente: ${brief.primaryColor} (usa-a como primaryColor).` : "";
  const user = `Cria o website de "${brief.businessName}"${brief.industry ? ` (sector: ${brief.industry})` : ""}${
    brief.domain ? `, domínio ${brief.domain}` : ""
  }${brief.tagline ? `, slogan: "${brief.tagline}"` : ""}.

Brief do cliente:
"""${brief.brief.slice(0, 4000)}"""

${theme}
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