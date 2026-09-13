import "server-only";

import { simulatedEmailProvider } from "./providers/simulated";
import { whmEmailProvider } from "./providers/whm";
import type { EmailProvider } from "./types";

export const EMAIL_PROVIDERS: EmailProvider[] = [whmEmailProvider, simulatedEmailProvider];

export type EmailProviderSelection = {
  provider: EmailProvider;
  mode: "live" | "simulated";
};

/**
 * Picks the first configured real provider, honouring an explicit
 * PROVISIONING_EMAIL_PROVIDER override (email-whm | email-simulated).
 * Falls back to the simulated provider when nothing is configured.
 */
export function selectEmailProvider(): EmailProviderSelection {
  const forced = process.env.PROVISIONING_EMAIL_PROVIDER?.toLowerCase();

  if (forced && forced !== "email-simulated") {
    const match = EMAIL_PROVIDERS.find(
      (p) => p.id === forced || p.id === `email-${forced}`,
    );
    if (match?.configured) return { provider: match, mode: "live" };
  }

  const configured = EMAIL_PROVIDERS.find((p) => p.configured && p.id !== "email-simulated");
  if (configured && forced !== "email-simulated") {
    return { provider: configured, mode: "live" };
  }

  return { provider: simulatedEmailProvider, mode: "simulated" };
}