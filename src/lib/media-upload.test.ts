import { describe, it, expect } from "vitest";
import { saveBrandingMedia } from "./media-upload";

describe("saveBrandingMedia", () => {
  it("aceita um ficheiro PNG válido e gera URL público", async () => {
    const dummyBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = await saveBrandingMedia({
      file: dummyBytes,
      mime: "image/png",
      originalName: "logo.png",
      kind: "logo",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toMatch(/^\/uploads\/branding\/logo-.+\.png$/);
      expect(result.mime).toBe("image/png");
      expect(result.size).toBe(8);
    }
  });

  it("rejeita ficheiro com formato não permitido", async () => {
    const dummyBytes = new Uint8Array([1, 2, 3, 4]);
    const result = await saveBrandingMedia({
      file: dummyBytes,
      mime: "application/x-executable",
      originalName: "virus.exe",
      kind: "brand",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/não suportado/i);
    }
  });

  it("rejeita ficheiros maiores que 2 MB", async () => {
    const oversize = new Uint8Array(2 * 1024 * 1024 + 1);
    const result = await saveBrandingMedia({
      file: oversize,
      mime: "image/jpeg",
      originalName: "grande.jpg",
      kind: "logo",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/demasiado grande/i);
    }
  });
});
