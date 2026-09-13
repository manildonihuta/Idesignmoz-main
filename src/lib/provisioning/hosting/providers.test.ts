import { describe, expect, it } from "vitest";

import { selectHostingProvider } from "./registry";
import { simulatedHostingProvider } from "./providers/simulated";
import { whmProvider } from "./providers/whm";
import { pleskProvider } from "./providers/plesk";
import { cloudVpsProvider } from "./providers/cloud-vps";

const DB_BACKED: string[] = ["accounts", "usage", "websites", "databases", "backups", "ssl", "php", "performance", "security", "alerts"];
const NOT_DB_SIMULATED: string[] = ["files", "ssh", "email", "cron", "staging"];

describe("hosting provider capabilities", () => {
  it("simulado cobre as funcionalidades suportadas pela base de dados", () => {
    for (const cap of DB_BACKED) {
      expect(simulatedHostingProvider.capabilities).toContain(cap);
    }
  });

  it("simulado não declara funcionalidades sem infraestrutura real", () => {
    for (const cap of NOT_DB_SIMULATED) {
      expect(simulatedHostingProvider.capabilities).not.toContain(cap);
    }
  });

  it("provedores reais só expõem contas", () => {
    for (const provider of [whmProvider, pleskProvider, cloudVpsProvider]) {
      expect(provider.capabilities).toEqual(["accounts"]);
    }
  });

  it("selectHostingProvider cai para o simulado sem configuração", () => {
    const original = process.env.PROVISIONING_HOSTING_PROVIDER;
    delete process.env.PROVISIONING_HOSTING_PROVIDER;
    delete process.env.WHM_SERVER_HOST;
    delete process.env.WHM_API_TOKEN;
    delete process.env.PLESK_HOST;
    delete process.env.VPS_API_URL;
    delete process.env.VPS_API_KEY;

    try {
      const sel = selectHostingProvider();
      expect(sel.mode).toBe("simulated");
      expect(sel.provider.id).toBe("simulated");
    } finally {
      if (original === undefined) {
        delete process.env.PROVISIONING_HOSTING_PROVIDER;
      } else {
        process.env.PROVISIONING_HOSTING_PROVIDER = original;
      }
    }
  });
});