import { describe, it, expect } from "vitest";
import {
  contactSchema,
  loginSchema,
  signupSchema,
  domainOrderSchema,
} from "./schemas";

describe("contactSchema", () => {
  const valid = {
    name: "Ana",
    email: "ana@empresa.com",
    service: "Design de website",
    message: "Quero um website completo para o meu negócio.",
  };

  it("aceita um pedido válido", () => {
    const result = contactSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const result = contactSchema.safeParse({ ...valid, email: "nao-e-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Email inválido.");
    }
  });

  it("rejeita nome com menos de 2 caracteres", () => {
    const result = contactSchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/nome/i);
    }
  });

  it("rejeita mensagem demasiado curta", () => {
    const result = contactSchema.safeParse({ ...valid, message: "curta" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("message");
    }
  });
});

describe("loginSchema", () => {
  it("aceita credenciais válidas", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "segredo" });
    expect(result.success).toBe(true);
  });

  it("rejeita password vazia", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("aceita password de 6 ou mais caracteres", () => {
    const result = signupSchema.safeParse({
      full_name: "João",
      email: "joao@empresa.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita password curta", () => {
    const result = signupSchema.safeParse({
      full_name: "João",
      email: "joao@empresa.com",
      password: "123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/6/);
    }
  });
});

describe("domainOrderSchema", () => {
  it("aceita um pedido de domínio válido", () => {
    const result = domainOrderSchema.safeParse({
      name: "Carlos",
      email: "carlos@empresa.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const result = domainOrderSchema.safeParse({ name: "Carlos", email: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Email inválido.");
    }
  });
});
