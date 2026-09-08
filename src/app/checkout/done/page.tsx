import "server-only";

import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { OrderAutoRefresh } from "@/components/order-auto-refresh";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Encomenda confirmada",
};

type ActivationStep = {
  key: string;
  label: string;
  detail: string;
  status: "done" | "pending" | "failed";
  link?: string;
};

function camelMeta(row: Record<string, unknown>): Record<string, unknown> {
  return (row.meta ?? {}) as Record<string, unknown>;
}

export default async function CheckoutDonePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const orderId = typeof id === "string" && id ? id.trim() : "";

  const steps: ActivationStep[] = [];
  let order: Record<string, unknown> | null = null;

  if (orderId) {
    const { data: orderRow } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    order = (orderRow ?? null) as Record<string, unknown> | null;

    if (order) {
      const [paymentsRes, itemsRes, accountsRes, domainsRes, jobsRes] = await Promise.all([
        supabaseAdmin.from("payments").select("*").eq("order_id", orderId),
        supabaseAdmin.from("order_items").select("*").eq("order_id", orderId),
        supabaseAdmin.from("hosting_accounts").select("*").eq("order_id", orderId),
        supabaseAdmin.from("domains").select("*").eq("order_id", orderId),
        supabaseAdmin.from("provisioning_jobs").select("*").eq("order_id", orderId),
      ]);

      const paid = Array.isArray(paymentsRes.data) && paymentsRes.data.length > 0;
      steps.push({
        key: "payment",
        label: "Pagamento",
        detail: paid ? "Pagamento confirmado." : "A aguardar confirmação do pagamento.",
        status: paid ? "done" : "pending",
      });

      const jobs = (jobsRes.data ?? []) as Record<string, unknown>[];
      const accounts = (accountsRes.data ?? []) as Record<string, unknown>[];
      const domains = (domainsRes.data ?? []) as Record<string, unknown>[];

      for (const account of accounts) {
        const job = jobs.find((j) => String(j.kind) === "hosting" && String(j.ref_id) === String(account.id));
        const accStatus = String(account.status ?? "pending");
        const domain = String(account.domain ?? "");
        let status: ActivationStep["status"] = "pending";
        let detail = "A ativar automaticamente no servidor…";
        if (accStatus === "active") {
          status = "done";
          detail = `Conta criada — ${String(account.username ?? "")}${typeof account.panel_url === "string" && account.panel_url ? ` · painel: ${account.panel_url}` : ""}.`;
        } else if (accStatus === "suspended" || accStatus === "terminated") {
          status = "failed";
          detail = "Conta suspensa. Contacta o suporte.";
        } else if (job && String(job.status) === "failed") {
          status = "failed";
          detail = String(job.last_error ?? "Não foi possível ativar. Contacta o suporte.");
        }
        steps.push({
          key: `hosting-${account.id}`,
          label: `Alojamento ${domain ? `· ${domain}` : ""}`,
          detail,
          status,
        });
      }

      for (const domain of domains) {
        const job = jobs.find((j) => String(j.kind) === "domain" && String(j.ref_id) === String(domain.id));
        const domStatus = String(domain.status ?? "pending");
        const fullDomain = String(domain.full_domain ?? "");
        let status: ActivationStep["status"] = "pending";
        let detail = "Registo de domínio em processamento…";
        if (domStatus === "registered") {
          status = "done";
          detail = `Domínio registado${domain.expires_at ? ` até ${new Date(String(domain.expires_at)).toLocaleDateString("pt-MZ")}` : ""}.`;
        } else if (job && String(job.status) === "failed") {
          status = "failed";
          detail = String(job.last_error ?? "Não foi possível registar. Contacta o suporte.");
        }
        steps.push({ key: `domain-${domain.id}`, label: fullDomain, detail, status });
      }

      for (const item of (itemsRes.data ?? []) as Record<string, unknown>[]) {
        const meta = camelMeta(item);
        const catalogKind = String(meta.catalog_kind ?? "");
        const isHosting = catalogKind === "hosting" || catalogKind === "email";
        const isDomain = catalogKind === "registration" || catalogKind === "renewal";
        if (isHosting || isDomain) continue;
        steps.push({
          key: `item-${item.id}`,
          label: String(item.label ?? "Serviço"),
          detail: "A nossa equipa vai entrar em contacto com os próximos passos.",
          status: "pending",
        });
      }
    }
  }

  const anyPending = steps.some((s) => s.status === "pending");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {order ? <OrderAutoRefresh pending={anyPending} /> : null}

      {!order ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="font-display-2 text-2xl font-semibold tracking-tight">Encomenda não encontrada</h1>
          <p className="mt-2 text-sm text-muted">Verifica o link ou contacta o suporte.</p>
          <Link className="button mt-6" href="/">
            Voltar ao início
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted">Obrigado pela sua compra.</p>
            <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
              Encomenda {String(order.number ?? orderId)}
            </h1>
          </div>

          <div className="order-card">
            <div className="order-head">
              <div>
                <span className="order-label">Estado</span>
                <h3>
                  {anyPending
                    ? "Em processamento"
                    : steps.every((s) => s.status === "done")
                      ? "Concluída"
                      : "Parcialmente processada"}
                </h3>
              </div>
              <span className={`order-status ${anyPending ? "pending" : "completed"}`}>
                {anyPending ? "processing" : "completed"}
              </span>
            </div>

            <div className="order-block">
              <span className="order-label">Próximos passos</span>
              <ul className="order-steps">
                {steps.map((step) => (
                  <li key={step.key} className={step.status}>
                    <span className="step-check">
                      {step.status === "done" ? "✓" : step.status === "failed" ? "!" : "○"}
                    </span>
                    <div>
                      <b>{step.label}</b>
                      <span className="block text-xs text-muted">{step.detail}</span>
                      {step.link ? (
                        <a className="text-xs underline" href={step.link}>
                          {step.link}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="checkout-actions">
              <Link className="button" href="/dashboard">
                Seguir no painel →
              </Link>
              {anyPending ? (
                <a className="outline-button" href={`/checkout/done?id=${orderId}`}>
                  Refrescar estado
                </a>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}