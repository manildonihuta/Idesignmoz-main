export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"] as const;

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export const DNS_ZONE_STATUSES = ["pending", "active", "disabled", "error", "manual"] as const;
export type DnsZoneStatus = (typeof DNS_ZONE_STATUSES)[number];

export const DNSSEC_STATUSES = ["disabled", "pending", "active", "error"] as const;
export type DnssecStatus = (typeof DNSSEC_STATUSES)[number];

export type DnsZone = {
  id: string;
  fullDomain: string;
  userId: string | null;
  provider: string;
  providerZoneId: string | null;
  status: DnsZoneStatus;
  nameservers: Record<string, string>;
  dnssec: DnssecStatus;
  createdAt: string;
  updatedAt: string;
};

export type DnsRecord = {
  id: string;
  zoneId: string;
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: number;
  priority: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DnsActivity = {
  id: string;
  zoneId: string;
  userId: string | null;
  action: string;
  recordType: string | null;
  recordId: string | null;
  oldValue: string | null;
  newValue: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type DnsBundle = {
  zone: DnsZone;
  records: DnsRecord[];
  activities: DnsActivity[];
};

export type PropagationCheck = {
  name: string;
  type: DnsRecordType | string;
  query: string;
  answers: string[];
  matched: boolean;
  checkedAt: string;
};

export type DnsRecordInput = {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: number;
  priority: number | null;
};

export type DnsNameserversInput = {
  ns1?: string;
  ns2?: string;
  ns3?: string;
  ns4?: string;
};

export const DNS_ACTIVITY_LABELS: Record<string, string> = {
  zone_created: "Zona criada",
  record_created: "Registo DNS criado",
  record_updated: "Registo DNS atualizado",
  record_deleted: "Registo DNS removido",
  nameservers_updated: "Nameservers atualizados",
  dnssec_enabled: "DNSSEC ativado",
  dnssec_disabled: "DNSSEC desativado",
  template_applied: "Modelo aplicado",
  propagation_checked: "Verificação de propagação",
  zone_synced: "Zona sincronizada",
};

export const ZONE_STATUS_LABELS: Record<DnsZoneStatus, string> = {
  pending: "Configuração pendente",
  active: "Ativo",
  disabled: "Desativado",
  error: "Erro",
  manual: "Configuração manual",
};

export const DNSSEC_LABELS: Record<DnssecStatus, string> = {
  disabled: "Desativado",
  pending: "Pendente",
  active: "Ativo",
  error: "Erro",
};