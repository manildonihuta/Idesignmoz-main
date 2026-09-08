import { describe, it, expect } from "vitest";
import { parseSitePayload, parseSectionPayload, parseSectionsInput } from "./builder-schema";

describe("parseSectionPayload", () => {
  it("normaliza uma secção hero e adiciona id", () => {
    const result = parseSectionPayload({ type: "hero", headline: "A melhor padaria do bairro" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.section.type).toBe("hero");
      expect(result.section.id).toMatch(/^sec-/);
      expect((result.section as { headline: string }).headline).toBe("A melhor padaria do bairro");
    }
  });

  it("rejeita tipo desconhecido", () => {
    const result = parseSectionPayload({ type: "foo", headline: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it("rejeita secção sem campo obrigatório", () => {
    const result = parseSectionPayload({ type: "hero" });
    expect(result.ok).toBe(false);
  });

  it("trunca listas acima do limite", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ title: `Item ${i}`, text: "ok" }));
    const result = parseSectionPayload({ type: "features", items });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.section as { items: unknown[] }).items.length).toBe(12);
    }
  });
});

describe("parseSitePayload", () => {
  const valid = {
    name: "Padaria Sabor do Bairro",
    tagline: "Fresquinho todos os dias",
    theme: { primaryColor: "#c8ff4d", mode: "dark", font: "sans" },
    seo: { title: "Padaria Sabor do Bairro — Maputo", description: "Pão fresco em Maputo." },
    pages: [
      {
        slug: "inicio",
        title: "Início",
        navLabel: "Início",
        sections: [
          { type: "hero", headline: "A melhor padaria do bairro" },
          { type: "services", heading: "Serviços", items: [{ name: "Pão artesanal" }] },
        ],
      },
      {
        slug: "contactos",
        title: "Contactos",
        sections: [{ type: "contact", email: "ola@sabor.co.mz" }],
      },
    ],
  };

  it("aceita um site válido e normaliza as secções", () => {
    const result = parseSitePayload(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.site.pages).toHaveLength(2);
      expect(result.site.pages[0].slug).toBe("inicio");
      expect((result.site.pages[0].sections[0] as unknown as { id: string }).id).toMatch(/^sec-/);
      expect(result.site.theme.primaryColor).toBe("#c8ff4d");
    }
  });

  it("rejeita site cuja primeira página não é 'inicio'", () => {
    const result = parseSitePayload({
      ...valid,
      pages: [{ slug: "sobre", title: "Sobre", sections: [{ type: "text", body: "ok" }] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("inicio");
  });

  it("descarta páginas sem secções válidas", () => {
    const result = parseSitePayload({
      ...valid,
      pages: [
        valid.pages[0],
        { slug: "vazia", title: "Vazia", sections: [] },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.site.pages.find((p) => p.slug === "vazia")).toBeUndefined();
    }
  });

  it("rejeita JSON não-objeto", () => {
    const result = parseSitePayload("olá");
    expect(result.ok).toBe(false);
  });

  it("rejeita resposta sem nome", () => {
    const result = parseSitePayload({ pages: valid.pages });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("nome");
  });
});

describe("parseSectionsInput", () => {
  it("aceita uma lista de secções válidas vinda do editor", () => {
    const sections = [
      { type: "text", heading: "Bem-vindo", body: "Texto de exemplo." },
      { type: "stats", items: [{ value: "500", label: "clientes" }] },
    ];
    const result = parseSectionsInput(sections);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sections).toHaveLength(2);
  });

  it("rejeita lista vazia", () => {
    const result = parseSectionsInput([]);
    expect(result.ok).toBe(false);
  });

  it("rejeita lista com secção desconhecida", () => {
    const result = parseSectionsInput([{ type: "missing", headline: "x" }]);
    expect(result.ok).toBe(false);
  });
});