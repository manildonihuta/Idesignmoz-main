import { createHash } from "node:crypto";

export const EMAIL_DNS_RECORD_TYPES = ["mx", "spf", "dkim", "dmarc"] as const;
export type EmailDnsRecordType = (typeof EMAIL_DNS_RECORD_TYPES)[number];

export type EmailDnsRecordValue = {
  type: "MX" | "TXT";
  name: string;
  value: string;
  priority: number | null;
};

export type EmailDnsRecordSpec = {
  recordType: EmailDnsRecordType;
  value: EmailDnsRecordValue;
  selector: string | null;
};

function defaultMxHost(): string {
  return process.env.EMAIL_MX_HOST?.trim() || "mx10.mail.idesignmoz.com";
}

function defaultSpfValue(): string {
  const include = process.env.EMAIL_SPF_INCLUDE?.trim() || "include:idesignmoz.com";
  return `v=spf1 ${include} ~all`;
}

/**
 * Deterministic illustrative DKIM public key. The platform does not send mail
 * yet, so this key is a stable, per-domain placeholder — the wizard shows a
 * truthful hint that the production key must come from the mail server once
 * outbound mail is enabled.
 */
function dkimKey(domain: string): string {
  const digest = createHash("sha256")
    .update(`idesignmoz-dkim:${domain}`)
    .digest("base64url");
  return `MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ${digest.slice(0, 210)}`;
}

export function buildEmailDnsRecords(domain: string): EmailDnsRecordSpec[] {
  const normalized = domain.trim().toLowerCase();
  return [
    {
      recordType: "mx",
      value: { type: "MX", name: "@", value: defaultMxHost(), priority: 10 },
      selector: null,
    },
    {
      recordType: "spf",
      value: { type: "TXT", name: "@", value: defaultSpfValue(), priority: null },
      selector: null,
    },
    {
      recordType: "dkim",
      value: {
        type: "TXT",
        name: "default._domainkey",
        value: `v=DKIM1; k=rsa; p=${dkimKey(normalized)}`,
        priority: null,
      },
      selector: "default",
    },
    {
      recordType: "dmarc",
      value: {
        type: "TXT",
        name: "_dmarc",
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${normalized}`,
        priority: null,
      },
      selector: null,
    },
  ];
}