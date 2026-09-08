import { z } from "zod";

export const CONTACT_SERVICES = ["Design de website", "Identidade de marca", "Alojamento", "Outra necessidade"] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Indique o seu nome.").max(120, "Nome demasiado longo."),
  email: z.string().trim().email("Email inválido.").max(320, "Email demasiado longo."),
  service: z.enum(CONTACT_SERVICES),
  message: z.string().trim().min(10, "Conte-nos um pouco mais (mín. 10 caracteres).").max(4000, "Mensagem demasiado longa."),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(1, "Indique a sua palavra-passe."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Indique o seu nome."),
  company: z.string().trim().optional(),
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(6, "Mínimo 6 caracteres."),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const domainOrderSchema = z.object({
  name: z.string().trim().min(2, "Indique o seu nome."),
  email: z.string().trim().email("Email inválido."),
});
export type DomainOrderInput = z.infer<typeof domainOrderSchema>;

export const apiDomainOrderSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320),
  fullDomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(4)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{2,20})+$/, "Domínio inválido."),
  extension: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(20)
    .regex(/^\.[a-z0-9-]+$/, "Extensão inválida."),
});
export type ApiDomainOrderInput = z.infer<typeof apiDomainOrderSchema>;

export const domainCheckQuerySchema = z.object({
  name: z.string().trim().min(2).max(63).regex(/^[a-z0-9-]+$/).refine((n) => !n.startsWith("-") && !n.endsWith("-"), {
    message: "Nome de domínio inválido.",
  }),
  extension: z.string().trim().toLowerCase().min(2).max(20).regex(/^\.[a-z0-9-]+$/),
});
export type DomainCheckQuery = z.infer<typeof domainCheckQuerySchema>;

export const domainRegisterSchema = z.object({
  orderId: z.string().uuid().optional(),
  fullDomain: z.string().trim().toLowerCase().min(4).max(253).regex(/^[a-z0-9.-]+$/),
  years: z.coerce.number().int().min(1).max(10).optional(),
});
export type DomainRegisterInput = z.infer<typeof domainRegisterSchema>;

export const proposalActionSchema = z
  .object({
    action: z.enum(["approve", "reject", "changes"]),
    comment: z.string().trim().max(2000).default(""),
  })
  .strict();
export type ProposalActionInput = z.infer<typeof proposalActionSchema>;

export const uuidSchema = z.string().uuid();
export type UuidInput = z.infer<typeof uuidSchema>;

export const messageStatusSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["new", "in_progress", "done"]),
  })
  .strict();
export type MessageStatusInput = z.infer<typeof messageStatusSchema>;

export const orderStatusSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["pending", "paid", "registered", "cancelled"]),
  })
  .strict();
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

export const profileRoleSchema = z
  .object({
    id: z.string().uuid(),
    role: z.enum(["super_admin", "admin", "manager", "sales", "developer", "designer", "support", "customer", "client"]),
  })
  .strict();
export type ProfileRoleInput = z.infer<typeof profileRoleSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().max(128).optional().default(""),
  type: z.enum(["all", "domain", "post", "project"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
