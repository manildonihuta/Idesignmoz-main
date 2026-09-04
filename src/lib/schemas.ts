import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Indique o seu nome."),
  email: z.string().trim().email("Email inválido."),
  service: z.string().min(1, "Seleccione um serviço."),
  message: z.string().trim().min(10, "Conte-nos um pouco mais (mín. 10 caracteres)."),
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
