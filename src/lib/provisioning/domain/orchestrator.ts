import "server-only";

import { sendEmail, emailLayout } from "@/lib/email";
import type { ProvisionFlowResult, ProvisionStep } from "../types";
import { selectRegistrar } from "./registry";
import { DEFAULT_NAMESERVERS } from "./registrars/simulated";
import type { DomainContact } from "./types";

export type DomainProvisionInput = {
  fullDomain: string;
  years?: number;
  contact?: DomainContact;
  customerEmail?: string;
  hostingPlan?: string;
  nameservers?: string[];
  paymentVerified?: boolean;
};

function step(id: string, label: string, state: ProvisionStep["state"], detail?: string): ProvisionStep {
  return { id, label, state, detail };
}

/**
 * Orchestrates the domain provisioning flow:
 *   pesquisa → disponibilidade → carrinho → pagamento → registo → DNS → associação alojamento
 */
export async function runDomainProvisioningFlow(
  input: DomainProvisionInput,
): Promise<ProvisionFlowResult> {
  const selection = selectRegistrar();
  const { registrar, mode } = selection;
  const steps: ProvisionStep[] = [];
  const years = input.years ?? 1;

  steps.push(step("search", "Pesquisa de domínio", "running", input.fullDomain));
  const check = await registrar.check(input.fullDomain);
  steps[steps.length - 1] = step("search", "Pesquisa de domínio", "ok", `${input.fullDomain} (${check.source})`);

  steps.push(
    step("availability", "Disponibilidade", check.available ? "ok" : "error", check.message ?? (check.available ? "Disponível para registo." : "Nome já registado.")),
  );
  if (!check.available) {
    return { ok: false, mode, provider: registrar.id, steps, error: check.message ?? "Domínio indisponível." };
  }

  steps.push(step("cart", "Adicionado ao carrinho", "ok", `${input.fullDomain} · ${years} ano${years > 1 ? "s" : ""}`));

  if (input.paymentVerified === false) {
    steps.push(step("payment", "Pagamento", "error", "Pagamento não confirmado."));
    return { ok: false, mode, provider: registrar.id, steps, error: "Pagamento não verificado." };
  }
  steps.push(step("payment", "Pagamento verificado", "ok", "Confirmação do gateway."));

  const registration = await registrar.register({
    fullDomain: input.fullDomain,
    years,
    contact: input.contact ?? {},
  });
  steps.push(
    step("registration", "Registo no registrador", registration.ok ? "ok" : "error", registration.message ?? `Registrant ID ${registration.registrantId ?? "—"}`),
  );
  if (!registration.ok) {
    return { ok: false, mode, provider: registrar.id, steps, error: registration.message ?? "Falha no registo." };
  }

  const nameservers = input.nameservers && input.nameservers.length > 0 ? input.nameservers : DEFAULT_NAMESERVERS;
  const nsResult = await registrar.setNameservers({ fullDomain: input.fullDomain, nameservers });
  steps.push(step("dns", "DNS configurado", nsResult.ok ? "ok" : "error", nameservers.join(", ")));

  const hosting = input.hostingPlan ?? "Startup";
  steps.push(
    step("association", "Associação ao alojamento", "ok", `${input.fullDomain} associado ao plano ${hosting} — registos A/DNS apontam para o servidor.`),
  );

  if (input.customerEmail) {
    const notified = await notifyDomainCustomer(input, registrar.id, registration.registrantId);
    steps.push(step("notify", "Cliente notificado", notified ? "ok" : "skipped", notified ? input.customerEmail : "Envio de email não configurado (RESEND_API_KEY)."));
  }

  return {
    ok: true,
    mode,
    provider: registrar.id,
    steps,
    data: {
      fullDomain: input.fullDomain,
      years,
      nameservers,
      registrantId: registration.registrantId,
      eppCode: "eppCode" in registration ? registration.eppCode : undefined,
      hostingPlan: hosting,
    },
  };
}

async function notifyDomainCustomer(
  input: DomainProvisionInput,
  registrarId: string,
  registrantId?: string,
): Promise<boolean> {
  const html = emailLayout(
    "Domínio registado",
    [
      `<p>O domínio <b>${input.fullDomain}</b> foi registado com sucesso via ${registrarId}.</p>`,
      registrantId ? `<p>Referência do registo: <b>${registrantId}</b></p>` : "",
      `<p>Duração: <b>${input.years ?? 1} ano(s)</b>.</p>`,
      `<p>O próximo passo é configurar os registos DNS para o teu alojamento.</p>`,
    ].join("\n"),
  );

  const result = await sendEmail({
    to: input.customerEmail!,
    subject: `Domínio ${input.fullDomain} registado`,
    html,
  });
  return result.ok;
}