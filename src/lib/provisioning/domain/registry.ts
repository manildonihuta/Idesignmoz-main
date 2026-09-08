import "server-only";

import { namecheapRegistrar } from "./registrars/namecheap";
import { simulatedRegistrar } from "./registrars/simulated";
import type { DomainRegistrar } from "./types";

export const REGISTRARS: DomainRegistrar[] = [namecheapRegistrar, simulatedRegistrar];

export type RegistrarSelection = {
  registrar: DomainRegistrar;
  mode: "live" | "simulated";
};

/**
 * Picks Namecheap when configured (or forced via PROVISIONING_DOMAIN_REGISTRAR),
 * otherwise the simulated registrar so the flow stays exercisable.
 */
export function selectRegistrar(): RegistrarSelection {
  const forced = process.env.PROVISIONING_DOMAIN_REGISTRAR?.toLowerCase();

  if (forced && forced !== "simulated") {
    const match = REGISTRARS.find((r) => r.id === forced && r.configured);
    if (match) return { registrar: match, mode: "live" };
  }

  if (namecheapRegistrar.configured && forced !== "simulated") {
    return { registrar: namecheapRegistrar, mode: "live" };
  }

  return { registrar: simulatedRegistrar, mode: "simulated" };
}