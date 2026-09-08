import "server-only";

import { encryptSecret, randomStrongPassword } from "../../credentials";
import { DEFAULT_NAMESERVERS, deriveUsername } from "../helpers";
import type { HostingProvider, HostingProviderAction, HostingProviderResult, HostingProvisionRequest, HostingProvisionResponse } from "../types";

/**
 * Plesk provisioning via XML API (enterprise/control/agent.php).
 * Requires PLESK_HOST + PLESK_LOGIN + PLESK_PASSWORD.
 * Creates a client + main webspace subscription in one packet.
 */
export const pleskProvider: HostingProvider = {
  id: "plesk",
  label: "Plesk",
  get configured() {
    return Boolean(process.env.PLESK_HOST && process.env.PLESK_LOGIN && process.env.PLESK_PASSWORD);
  },

  async provision(req: HostingProvisionRequest): Promise<HostingProvisionResponse> {
    const host = process.env.PLESK_HOST!;
    const login = process.env.PLESK_LOGIN!;
    const password = process.env.PLESK_PASSWORD!;
    const username = deriveUsername(req.domain, req.username);

    const packet = [
      "<packet version=\"1.6.6.0\">",
      "  <customer>",
      `    <add><gen_info><cname>${username}</cname><pname>${req.customerName}</pname><login>${username}</login><passwd>${randomStrongPassword()}</passwd><status>active</status></gen_info></add>`,
      "  </customer>",
      "  <webspace>",
      `    <add><gen_setup><name>${req.domain}</name><ip_address>${process.env.PLESK_IP ?? "0.0.0.0"}</ip_address><htype>vrt_hst</htype><status>active</status><plan-name>${req.planName}</plan-name></gen_setup></add>`,
      "  </webspace>",
      "</packet>",
    ].join("\n");

    const body = `<?xml version="1.0" encoding="UTF-8"?>\n${packet}`;
    const res = await fetch(`https://${host}:8443/enterprise/control/agent.php`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
      },
      body,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Plesk XML API falhou (HTTP ${res.status}).`);
    }
    const xml = await res.text();
    const err = xml.match(/<status>error<\/status>[\s\S]*?<errtext>([^<]+)<\/errtext>/i);
    if (err) {
      throw new Error((err[1] ?? "").trim() || "Plesk devolveu erro.");
    }

    return {
      providerId: "plesk",
      providerLabel: "Plesk",
      accountId: username,
      panelUrl: `https://${host}:8443`,
      username,
      nameservers: DEFAULT_NAMESERVERS,
      serverIp: process.env.PLESK_IP,
      planName: req.planName,
      createdAt: new Date().toISOString(),
      generatedPassword: randomStrongPassword(),
      encryptedPassword: encryptSecret(randomStrongPassword()),
    };
  },

  async suspend(action: HostingProviderAction): Promise<HostingProviderResult> {
    return pleskSetStatus(action.domain, "disabled");
  },

  async unsuspend(action: HostingProviderAction): Promise<HostingProviderResult> {
    return pleskSetStatus(action.domain, "active");
  },

  async terminate(action: HostingProviderAction): Promise<HostingProviderResult> {
    return pleskRemove(action.domain);
  },
};

async function pleskSetStatus(domain: string, status: string): Promise<HostingProviderResult> {
  const host = process.env.PLESK_HOST;
  const login = process.env.PLESK_LOGIN;
  const password = process.env.PLESK_PASSWORD;
  if (!host) return { ok: false, message: "PLESK_HOST não configurado." };

  const packet = [
    "<packet version=\"1.6.6.0\">",
    "  <webspace>",
    `    <set><filter><name>${domain}</name></filter><values><gen_setup><status>${status}</status></gen_setup></values></set>`,
    "  </webspace>",
    "</packet>",
  ].join("\n");

  const res = await fetch(`https://${host}:8443/enterprise/control/agent.php`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n${packet}`,
    signal: AbortSignal.timeout(15000),
  });
  return { ok: res.ok };
}

async function pleskRemove(domain: string): Promise<HostingProviderResult> {
  const host = process.env.PLESK_HOST;
  const login = process.env.PLESK_LOGIN;
  const password = process.env.PLESK_PASSWORD;
  if (!host) return { ok: false, message: "PLESK_HOST não configurado." };

  const packet = [
    "<packet version=\"1.6.6.0\">",
    "  <webspace>",
    `    <del><filter><name>${domain}</name></filter></del>`,
    "  </webspace>",
    "</packet>",
  ].join("\n");

  const res = await fetch(`https://${host}:8443/enterprise/control/agent.php`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n${packet}`,
    signal: AbortSignal.timeout(15000),
  });
  return { ok: res.ok };
}