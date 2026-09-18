import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "./route";

vi.mock("@/lib/admin", () => ({
  requirePermissionRoute: vi.fn(async (perm: string) => {
    return {
      authenticated: true,
      ctx: { userId: "user-123", email: "admin@idesignmoz.com" },
      response: null,
    };
  }),
}));

vi.mock("@/lib/content", () => ({
  getProjects: vi.fn(async () => [
    {
      slug: "hotel-castel",
      client: "Hotel Castel",
      industry: "Hospitality",
      year: "2024",
      categories: ["Websites"],
      services: ["Website"],
      image: "https://example.com/image.jpg",
      summary: "Reservas sem fricção",
      challenge: "",
      strategy: "",
      design: "",
      development: "",
      technology: ["Next.js"],
      results: [],
      url: "https://hotelcastel.co.mz",
    },
  ]),
  invalidateContentCache: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: vi.fn(async () => ({ error: null })),
    })),
  },
}));

vi.mock("@/lib/security/audit", () => ({
  logAudit: vi.fn(async () => {}),
}));

vi.mock("@/lib/security/csrf", () => ({
  csrfError: vi.fn((req: NextRequest) => {
    if (req.headers.get("x-test-csrf-fail")) return "Origem de pedido não autorizada.";
    return null;
  }),
  csrfFailure: vi.fn(() => Response.json({ ok: false, error: "Origem de pedido não autorizada." }, { status: 403 })),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
  rateLimitResponse: vi.fn(),
  clientIp: vi.fn(() => "127.0.0.1"),
}));

describe("API /api/admin/portfolio", () => {
  it("GET devolve os projetos de portfólio", async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects[0].client).toBe("Hotel Castel");
    expect(data.projects[0].url).toBe("https://hotelcastel.co.mz");
  });

  it("PUT aceita e guarda lista de trabalhos com URLs", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/portfolio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projects: [
          {
            client: "Novo Cliente",
            industry: "Tecnologia",
            year: "2026",
            services: ["SaaS", "Design"],
            url: "https://novocliente.mz",
            summary: "Projeto de tecnologia inovador",
            image: "https://example.com/cover.png",
          },
        ],
      }),
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].client).toBe("Novo Cliente");
    expect(data.projects[0].url).toBe("https://novocliente.mz");
    expect(data.projects[0].services).toEqual(["SaaS", "Design"]);
  });

  it("PUT bloqueia pedido com erro de CSRF", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/portfolio", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-test-csrf-fail": "true",
      },
      body: JSON.stringify({ projects: [] }),
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/autorizada/i);
  });
});
