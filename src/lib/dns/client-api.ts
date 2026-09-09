import type { DnsActivity, DnsBundle, DnsRecordInput, PropagationCheck } from "@/lib/dns/types";

type ApiError = { ok: false; error: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON failure — surface a generic message.
  }
  const body = (json ?? {}) as Partial<ApiError>;
  if (!res.ok) {
    throw new Error(body.error ?? "Erro ao comunicar com o servidor.");
  }
  return json as T;
}

function mutInit(method: string, payload?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  };
}

export type BundleResult = { bundle: DnsBundle };
export type PropagationResult = { bundle: DnsBundle; checks: PropagationCheck[] };
export type TemplateResult = { bundle: DnsBundle; added: number; skipped: number };
export type ActivityResult = { activities: DnsActivity[] };

export const dnsApi = {
  bundle(fullDomain: string): Promise<BundleResult> {
    return request(`/api/dns/${encodeURIComponent(fullDomain)}`);
  },
  createRecord(fullDomain: string, input: DnsRecordInput): Promise<BundleResult> {
    return request(`/api/dns/${encodeURIComponent(fullDomain)}/records`, mutInit("POST", input));
  },
  updateRecord(fullDomain: string, recordId: string, input: DnsRecordInput): Promise<BundleResult> {
    return request(`/api/dns/${encodeURIComponent(fullDomain)}/records/${recordId}`, mutInit("PATCH", input));
  },
  deleteRecord(fullDomain: string, recordId: string): Promise<BundleResult> {
    return request(`/api/dns/${encodeURIComponent(fullDomain)}/records/${recordId}`, mutInit("DELETE"));
  },
  updateNameservers(fullDomain: string, nameservers: Record<string, string>): Promise<BundleResult> {
    return request(`/api/dns/${encodeURIComponent(fullDomain)}/nameservers`, mutInit("PUT", nameservers));
  },
  setDnssec(fullDomain: string, enabled: boolean): Promise<BundleResult> {
    return request(`/api/dns/${encodeURIComponent(fullDomain)}/dnssec`, mutInit("POST", { enabled }));
  },
  checkPropagation(fullDomain: string): Promise<PropagationResult> {
    return request(`/api/dns/${encodeURIComponent(fullDomain)}/propagation`, mutInit("POST"));
  },
  applyTemplate(fullDomain: string, templateId: string): Promise<TemplateResult> {
    return request(`/api/dns/${encodeURIComponent(fullDomain)}/templates`, mutInit("POST", { templateId }));
  },
  activity(fullDomain: string): Promise<ActivityResult> {
    return request(`/api/dns/${encodeURIComponent(fullDomain)}/activity`);
  },
};