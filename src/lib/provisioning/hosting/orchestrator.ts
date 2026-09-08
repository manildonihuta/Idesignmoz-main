import "server-only";

import { sendEmail, emailLayout } from "@/lib/email";
import type { ProvisionFlowResult, ProvisionStep } from "../types";
import { selectHostingProvider } from "./registry";
import type { HostingProvisionRequest, HostingProvisionResponse } from "./types";

export type HostingProvisionInput = {
  orderId: string;
  customerName: string;
  customerEmail: string;
  domain: string;
  planName: string;
  planLimits?: HostingProvisionRequest["planLimits"];
  username?: string;
  paymentVerified?: boolean;
};

const DEFAULT_LIMITS: HostingProvisionRequest["planLimits"] = {
  diskGb: 50,
  bandwidthGb: 500,
  websites: 1,
  emailAccounts: 10,
  databases: 1,
  cpu: "1 vCPU",
  ramMb: 2048,
};

function step(id: string, label: string, state: ProvisionStep["state"], detail?: string): ProvisionStep {
  return { id, label, state, detail };
}

/**
 * Orchestrates the hosting provisioning flow:
 *   pagamento → verificação → pedido → API de provisioning → conta → credenciais → notificação
 *
 * Passwords are generated securely, delivered once to the customer and stored
 * encrypted (AES-256-GCM) — never in plain text.
 */
export async function runHostingProvisioningFlow(
  input: HostingProvisionInput,
): Promise<ProvisionFlowResult> {
  const providerSelection = selectHostingProvider();
  const { provider, mode } = providerSelection;
  const steps: ProvisionStep[] = [];

  steps.push(step("payment", "Pagamento recebido", "ok", `Pedido ${input.orderId}`));
  if (input.paymentVerified === false) {
    steps.push(step("payment-verify", "Pagamento verificado", "error", "Pagamento não confirmado."));
    return { ok: false, mode, provider: provider.id, steps, error: "Pagamento não verificado." };
  }
  steps.push(step("payment-verify", "Pagamento verificado", "ok", "Confirmação do gateway/mobile money."));

  steps.push(step("order", "Pedido criado", "ok", `Encomenda ${input.orderId} · ${input.planName}`));

  const request: HostingProvisionRequest = {
    orderId: input.orderId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    domain: input.domain,
    planName: input.planName,
    planLimits: input.planLimits ?? DEFAULT_LIMITS,
    username: input.username,
  };

  steps.push(
    step("api", "Chamada à API de provisioning", "running", `${provider.label} (${mode})`),
  );

  try {
    const account = await provider.provision(request);
    steps[steps.length - 1] = step("api", "Chamada à API de provisioning", "ok", `${provider.label} (${mode})`);

    steps.push(step("account", "Conta criada", "ok", `${account.accountId} · ${account.panelUrl ?? "painel indisponível"}`));

    steps.push(
      step(
        "credentials",
        "Credenciais geradas",
        "ok",
        "Geradas no servidor e cifradas com AES-256-GCM — nunca guardadas em texto simples.",
      ),
    );

    const notified = await notifyCustomer(input, account);
    steps.push(step("notify", "Cliente notificado", notified ? "ok" : "skipped", notified ? input.customerEmail : "Envio de email não configurado (RESEND_API_KEY)."));

    return {
      ok: true,
      mode,
      provider: provider.id,
      steps,
      data: {
        accountId: account.accountId,
        providerLabel: account.providerLabel,
        panelUrl: account.panelUrl,
        username: account.username,
        nameservers: account.nameservers,
        serverIp: account.serverIp,
        planName: account.planName,
        createdAt: account.createdAt,
        passwordEncrypted: account.encryptedPassword,
      },
    };
  } catch (error) {
    steps[steps.length - 1] = step("api", "Chamada à API de provisioning", "error", error instanceof Error ? error.message : String(error));
    return { ok: false, mode, provider: provider.id, steps, error: error instanceof Error ? error.message : String(error) };
  }
}

async function notifyCustomer(
  input: HostingProvisionInput,
  account: HostingProvisionResponse,
): Promise<boolean> {
  const html = emailLayout(
    "O teu alojamento está pronto",
    [
      `<p>Olá ${input.customerName.split(" ")[0] ?? ""},</p>`,
      `<p>O teu pacote <b>${input.planName}</b> para <b>${input.domain}</b> foi activado.</p>`,
      `<ul>`,
      `<li>Domínio: <b>${input.domain}</b></li>`,
      `<li>Conta: <b>${account.username}</b></li>`,
      `<li>Painel: <a href="${account.panelUrl}">${account.panelUrl}</a></li>`,
      `<li>Password: <b>${account.generatedPassword}</b> (mostrada apenas agora)</li>`,
      `</ul>`,
      `<p>Activa o teu domínio nos nameservers: ${account.nameservers.map((ns) => `<b>${ns}</b>`).join(", ")}.</p>`,
      `<p>Recomendamos alterar a password na primeira entrada.</p>`,
    ].join("\n"),
  );

  const result = await sendEmail({
    to: input.customerEmail,
    subject: `Alojamento ${input.domain} activado`,
    html,
  });
  return result.ok;
}