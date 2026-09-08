import "server-only";

export function slugifyUsername(raw: string): string {
  const base = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return base.slice(0, 8) || "host";
}

export function deriveUsername(domain: string, preferred?: string): string {
  if (preferred) return slugifyUsername(preferred);
  const baseName = domain.split(".")[0] ?? "host";
  return slugifyUsername(baseName);
}

export const DEFAULT_NAMESERVERS = ["ns1.idesignmoz.com", "ns2.idesignmoz.com"];