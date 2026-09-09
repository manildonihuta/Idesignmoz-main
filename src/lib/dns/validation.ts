import { z } from "zod";

import { DNS_RECORD_TYPES, type DnsRecordInput } from "@/lib/dns/types";

export const TTL_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "300", label: "300 (5 min)" },
  { value: "600", label: "600 (10 min)" },
  { value: "1800", label: "1800 (30 min)" },
  { value: "3600", label: "3600 (1 hora)" },
  { value: "7200", label: "7200 (2 horas)" },
  { value: "14400", label: "14400 (4 horas)" },
  { value: "86400", label: "86400 (1 dia)" },
] as const;

export const AUTO_TTL = 3600;

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const IPV6 =
  /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?$/;

const HOST_FQDN =
  /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*\.?$/;

const NAME_LABEL = /^[a-zA-Z0-9_*-]{1,63}$/;

export function isValidDnsName(name: string): boolean {
  if (name === "@") return true;
  if (!name) return false;
  const labels = name.split(".");
  if (labels.length > 10 || name.length > 253) return false;
  return labels.every((label) => NAME_LABEL.test(label));
}

function isHostname(value: string): boolean {
  if (!value || value === "@" || value.endsWith(".") && value === ".") return false;
  return HOST_FQDN.test(value);
}

const baseRecord = {
  type: z.enum(DNS_RECORD_TYPES),
  name: z.string().trim().min(1).max(253),
  value: z.string().trim().min(1).max(2048),
  ttl: z.number().int().min(60).max(86400),
  priority: z.number().int().min(0).max(65535).nullable().optional(),
};

export const dnsRecordSchema = z
  .object(baseRecord)
  .superRefine((data, ctx) => {
    if (!isValidDnsName(data.name)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: "Nome de registo inválido." });
    }

    switch (data.type) {
      case "A":
        if (!IPV4.test(data.value)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Indique um IPv4 válido, ex. 149.210.210.210." });
        }
        break;
      case "AAAA":
        if (!IPV6.test(data.value)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Indique um IPv6 válido." });
        }
        break;
      case "CNAME":
        if (!isHostname(data.value)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Indique um hostname válido, ex. proxy-ssl.idesignmoz.com." });
        }
        break;
      case "NS":
        if (!isHostname(data.value)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Indique um hostname válido, ex. ns1.idesignmoz.com." });
        }
        break;
      case "MX":
        if (!isHostname(data.value)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Indique um hostname válido, ex. mail.idesignmoz.com." });
        }
        if (data.priority == null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priority"], message: "Indique a prioridade para registos MX." });
        }
        break;
      case "SRV": {
        const parts = data.value.split(/\s+/);
        if (parts.length !== 3) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Formato: peso porta alvo — ex. 10 60 sip.idesignmoz.com." });
          break;
        }
        const [weight, port, target] = parts;
        if (!/^\d{1,5}$/.test(weight) || Number(weight) > 65535) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Peso inválido (0–65535)." });
        }
        if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Porta inválida (1–65535)." });
        }
        if (target !== "." && !isHostname(target)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Alvo inválido (hostname ou \".\")." });
        }
        if (data.priority == null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priority"], message: "Indique a prioridade para registos SRV." });
        }
        break;
      }
      case "TXT":
        if (data.value.length > 1024) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "O valor TXT não pode exceder 1024 caracteres." });
        }
        break;
      case "CAA": {
        const parts = data.value.split(/\s+/);
        if (parts.length < 3) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Formato: flag tag valor — ex. 0 issue \"letsencrypt.org\"." });
          break;
        }
        const [flag, tag] = parts;
        if (!/^\d{1,3}$/.test(flag) || Number(flag) > 255) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Flag CAA inválida (0–255)." });
        }
        if (!["issue", "issuewild", "iodef", "contactemail", "contactphone"].includes(tag.toLowerCase())) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Tag CAA inválida (issue, issuewild, iodef…)." });
        }
        break;
      }
    }
  });

export type DnsRecordSchemaInput = z.infer<typeof dnsRecordSchema>;

export function parseDnsRecordInput(raw: unknown): { ok: true; data: DnsRecordInput } | { ok: false; message: string } {
  const result = dnsRecordSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, message: first?.message ?? "Registo DNS inválido." };
  }
  return {
    ok: true,
    data: {
      type: result.data.type,
      name: result.data.name,
      value: result.data.value,
      ttl: result.data.ttl,
      priority: result.data.priority ?? null,
    },
  };
}

const nsField = z
  .string()
  .trim()
  .max(253)
  .refine((v) => v === "" || isHostname(v), { message: "Hostname inválido." });

export const nameserversSchema = z
  .object({
    ns1: nsField,
    ns2: nsField,
    ns3: nsField,
    ns4: nsField,
  })
  .superRefine((data, ctx) => {
    if (!isHostname(data.ns1) || !isHostname(data.ns2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ns1"],
        message: "Indique pelos menos ns1 e ns2 válidos.",
      });
    }
    if (data.ns3 && data.ns3 === data.ns1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ns3"], message: "ns3 é igual a ns1." });
    }
    if (data.ns4 && data.ns4 === data.ns2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ns4"], message: "ns4 é igual a ns2." });
    }
  });

export function parseNameserversInput(raw: unknown): { ok: true; data: Record<string, string> } | { ok: false; message: string } {
  const result = nameserversSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, message: first?.message ?? "Nameservers inválidos." };
  }
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(result.data)) {
    if (value) data[key] = value.replace(/\.$/, "");
  }
  return { ok: true, data };
}

export function resolveTtl(value: number | "auto" | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 60 && value <= 86400) return value;
  return AUTO_TTL;
}