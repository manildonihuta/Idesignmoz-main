import type { HostingCapability } from "@/lib/provisioning/hosting/types";

export type ProviderCategory = "domain" | "dns" | "hosting" | "email" | "ssl" | "cdn" | "backup" | "storage";

export type ProviderStatus = "active" | "inactive" | "maintenance" | "degraded" | "error" | "unknown";

export type ProviderHealthState = "healthy" | "degraded" | "unavailable" | "unknown";

export type ProviderEnvironment = "production" | "staging" | "development";

export const PROVIDER_CATEGORIES: readonly ProviderCategory[] = [
  "domain",
  "dns",
  "hosting",
  "email",
  "ssl",
  "cdn",
  "backup",
  "storage",
];

export const PROVIDER_CATEGORY_LABEL: Record<ProviderCategory, string> = {
  domain: "Domínios",
  dns: "DNS",
  hosting: "Alojamento",
  email: "Email",
  ssl: "SSL",
  cdn: "CDN",
  backup: "Backups",
  storage: "Armazenamento",
};

export const PROVIDER_STATUS_LABEL: Record<ProviderStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  maintenance: "Manutenção",
  degraded: "Degradado",
  error: "Erro",
  unknown: "Desconhecido",
};

export const PROVIDER_HEALTH_LABEL: Record<ProviderHealthState, string> = {
  healthy: "Saudável",
  degraded: "Degradado",
  unavailable: "Indisponível",
  unknown: "Desconhecido",
};

/**
 * Feature-level capability keys (dot notation: <category>.<feature>). They are
 * stored in `providers.capabilities` and drive which actions/UI are enabled for
 * a provider. Hosting capabilities reuse the existing HostingCapability set.
 */
export type InfraCapability =
  | "domain.search"
  | "domain.register"
  | "domain.renew"
  | "domain.transfer"
  | "domain.lock"
  | "domain.nameservers"
  | "dns.zones"
  | "dns.records"
  | "dns.nameservers"
  | "dns.dnssec"
  | "dns.propagation"
  | "hosting.accounts"
  | "hosting.usage"
  | "hosting.websites"
  | "hosting.databases"
  | "hosting.backups"
  | "hosting.ssl"
  | "hosting.php"
  | "hosting.cron"
  | "hosting.ssh"
  | "hosting.email"
  | "hosting.files"
  | "hosting.performance"
  | "hosting.security"
  | "hosting.staging"
  | "hosting.alerts"
  | "hosting.suspend"
  | "hosting.unsuspend"
  | "hosting.terminate"
  | "email.mailboxes"
  | "email.forwarders"
  | "email.aliases"
  | "email.autoresponders"
  | "ssl.issue"
  | "ssl.install"
  | "ssl.renew"
  | "ssl.revoke"
  | "cdn.enable"
  | "cdn.purge"
  | "cdn.caching"
  | "cdn.security"
  | "backup.create"
  | "backup.restore";

export type ProviderCapabilitySet = readonly InfraCapability[];

/** Truthful mapping of a HostingCapability into the infra capability key set. */
export function mapHostingCapability(capability: HostingCapability): InfraCapability {
  switch (capability) {
    case "accounts":
      return "hosting.accounts";
    case "usage":
      return "hosting.usage";
    case "websites":
      return "hosting.websites";
    case "databases":
      return "hosting.databases";
    case "backups":
      return "hosting.backups";
    case "ssl":
      return "hosting.ssl";
    case "php":
      return "hosting.php";
    case "cron":
      return "hosting.cron";
    case "ssh":
      return "hosting.ssh";
    case "email":
      return "hosting.email";
    case "files":
      return "hosting.files";
    case "performance":
      return "hosting.performance";
    case "security":
      return "hosting.security";
    case "staging":
      return "hosting.staging";
    case "alerts":
      return "hosting.alerts";
  }
}

export const INFRA_CAPABILITY_LABEL: Record<InfraCapability, string> = {
  "domain.search": "Pesquisa de domínios",
  "domain.register": "Registo de domínios",
  "domain.renew": "Renovação de domínios",
  "domain.transfer": "Transferência de domínios",
  "domain.lock": "Bloqueio de domínios",
  "domain.nameservers": "Nameservers de domínios",
  "dns.zones": "Zonas DNS",
  "dns.records": "Registos DNS",
  "dns.nameservers": "Nameservers DNS",
  "dns.dnssec": "DNSSEC",
  "dns.propagation": "Verificação de propagação",
  "hosting.accounts": "Gestão de contas",
  "hosting.usage": "Uso e estatísticas",
  "hosting.websites": "Websites",
  "hosting.databases": "Bases de dados",
  "hosting.backups": "Backups",
  "hosting.ssl": "Certificados SSL",
  "hosting.php": "Versões PHP",
  "hosting.cron": "Tarefas cron",
  "hosting.ssh": "Acesso SSH",
  "hosting.email": "Contas de email",
  "hosting.files": "Gestor de ficheiros",
  "hosting.performance": "Desempenho",
  "hosting.security": "Segurança",
  "hosting.staging": "Ambientes de teste",
  "hosting.alerts": "Alertas",
  "hosting.suspend": "Suspensão de contas",
  "hosting.unsuspend": "Reativação de contas",
  "hosting.terminate": "Remoção de contas",
  "email.mailboxes": "Mailboxes",
  "email.forwarders": "Redirecionadores",
  "email.aliases": "Aliases",
  "email.autoresponders": "Respostas automáticas",
  "ssl.issue": "Emissão de certificados",
  "ssl.install": "Instalação de SSL",
  "ssl.renew": "Renovação de SSL",
  "ssl.revoke": "Revogação de SSL",
  "cdn.enable": "Ativação de CDN",
  "cdn.purge": "Purga de cache",
  "cdn.caching": "Configuração de cache",
  "cdn.security": "Proteção CDN",
  "backup.create": "Criação de backups",
  "backup.restore": "Restauro de backups",
};