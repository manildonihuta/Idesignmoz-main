"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSyncExternalStore } from "react";

import { cartTotal, clearCart, cartCategories, getServerSnapshot, getSnapshot, kindLabel, subscribe } from "@/lib/cart";
import {
  CATEGORY_LABEL_PT,
  CATEGORY_ICON,
  UPSEL_CHAIN,
  type ProductCategory,
} from "@/lib/catalog-types";
import {
  crossSellOffers,
  defaultProductForCategory,
  suggestUpsells,
  useCatalog,
} from "@/lib/catalog-client";
import { trackEvent } from "@/lib/analytics-client";
import {
  getProductKind,
  buildOrder,
  saveOrder,
  type Order,
} from "@/lib/orders";
import {
  generateReference,
  PAYMENT_METHODS,
  type PaymentIntent,
  type PaymentMethodId,
  type PaymentResult,
} from "@/lib/payment-providers";
import { CatalogAddButton } from "@/components/catalog-add-button";
import { CrossSellRecommendations } from "@/components/cross-sell-recommendations";
import { Stepper } from "@/components/ui/core";

const STEPS = ["Customer", "Products", "Billing", "Payment", "Confirmation"] as const;
type Step = (typeof STEPS)[number];

type CustomerData = {
  fullName: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  nuit: string;
};

const EMPTY_CUSTOMER: CustomerData = {
  fullName: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  nuit: "",
};

function fmt(price: number): string {
  return new Intl.NumberFormat("pt-MZ").format(price);
}

function periodLabel(period: string): string {
  if (period === "monthly") return "por mês";
  if (period === "annual") return "por ano";
  return "pagamento único";
}

function CheckoutUpsell() {
  const { data: catalog } = useCatalog();
  const products = catalog?.products ?? [];
  const suggested = suggestUpsells(cartCategories());
  if (suggested.length === 0) {
    return null;
  }
  const inCart = new Set(cartCategories());
  return (
    <div className="checkout-upsell">
      <h3>Recomendados para si</h3>
      <div className="upsell-path" aria-label="Fases recomendadas">
        {UPSEL_CHAIN.map((cat, index) => (
          <span key={cat} className={inCart.has(cat) ? "in" : ""}>
            {index > 0 ? " → " : ""}
            {CATEGORY_LABEL_PT[cat]}
          </span>
        ))}
      </div>
      <p>
        Complete o seu ecossistema digital — adicione o passo seguinte e leve-o
        no mesmo pagamento.
      </p>
      <div className="upsell-grid">
        {suggested.map((cat) => {
          const product = defaultProductForCategory(cat, products);
          if (!product) {
            return null;
          }
          return (
            <div className="upsell-card" key={cat}>
              <b>
                {CATEGORY_ICON[cat]} {product.name}
              </b>
              <span>{product.description}</span>
              <CatalogAddButton productId={product.id} className="outline-button" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CheckoutForm() {
  const router = useRouter();
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { data: catalog } = useCatalog();
  const [step, setStep] = useState<Step>("Customer");
  const [customer, setCustomer] = useState<CustomerData>(EMPTY_CUSTOMER);
  const [method, setMethod] = useState<PaymentMethodId>("mpesa");
  const [reference] = useState(generateReference);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderOffers, setOrderOffers] = useState<ReturnType<typeof crossSellOffers>>([]);
  const [processing, setProcessing] = useState(false);

  const total = cartTotal();
  const stepIndex = STEPS.indexOf(step);

  function set<K extends keyof CustomerData>(key: K, value: string) {
    setCustomer((prev) => ({ ...prev, [key]: value }));
  }

  function hasCustomerData(): boolean {
    return Boolean(customer.fullName && customer.email && customer.phone);
  }

  function next() {
    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1]);
    }
  }

  function back() {
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1]);
    }
  }

  async function submitPayment() {
    setProcessing(true);
    trackEvent({ event: "checkout", page: "/checkout", value: total });
    const provider = PAYMENT_METHODS.find((p) => p.id === method);
    if (!provider) {
      return;
    }
    const intent: PaymentIntent = {
      method,
      amount: total,
      currency: "MT",
      reference,
      customerPhone: customer.phone,
      customerName: customer.fullName,
    };
    const paymentResult = await provider.process(intent);
    setResult(paymentResult);
    setProcessing(false);
    if (paymentResult.success) {
      let serverNumber: string | null = null;
      let serverOrderId: string | null = null;
      try {
        const res = await fetch("/api/checkout/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: {
              fullName: customer.fullName,
              company: customer.company,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
              nuit: customer.nuit,
            },
            method,
            reference,
            items: items.map((item) => ({
              fullDomain: item.fullDomain,
              extension: item.extension,
              price: item.price,
              kind: item.kind,
              label: item.label,
              period: item.period,
              productId: item.productId,
              category: item.category,
            })),
          }),
        });
        const data = await res.json();
        if (res.ok && data?.orderId) {
          serverOrderId = String(data.orderId);
          serverNumber = typeof data.number === "string" ? data.number : null;
        }
      } catch {
        // keep the local receipt even if server persistence fails
      }
      const created = buildOrder(items, total, {
        fullName: customer.fullName,
        email: customer.email,
      });
      if (serverNumber) {
        created.id = serverNumber;
      }
      saveOrder(created);
      setOrder(created);
      const boughtCategories = items
        .map((item) => item.category ?? (item.kind as ProductCategory))
        .filter((cat, idx, arr) => arr.indexOf(cat) === idx);
      setOrderOffers(crossSellOffers(boughtCategories, catalog?.products ?? []));
      clearCart();
      trackEvent({ event: "purchase", page: "/checkout", value: total, meta: { method, persisted: Boolean(serverNumber) } });
      trackEvent({ event: "customer", page: "/checkout" });
      if (serverOrderId) {
        router.push(`/checkout/done?id=${serverOrderId}`);
        return;
      }
      setStep("Confirmation");
    }
  }

  if (items.length === 0 && step !== "Confirmation") {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-muted">O seu carrinho está vazio.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link className="button" href="/domains">
            Procurar domínio ↗
          </Link>
          <Link className="outline-button" href="/hosting">
            Ver alojamento ↗
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-layout">
      {/* Stepper */}
      <Stepper
        steps={STEPS.map((label, index) => ({
          label,
          done: index < stepIndex,
          current: index === stepIndex,
        }))}
      />

      {/* Step: 01 Customer */}
      {step === "Customer" && (
        <section className="checkout-panel">
          <h2>01 · Customer</h2>
          <p className="checkout-hint">Quem está a realizar esta compra?</p>
          <div className="checkout-formgrid">
            <label className="checkout-field">
              Full Name *
              <input
                type="text"
                value={customer.fullName}
                onChange={(event) => set("fullName", event.target.value)}
                placeholder="O seu nome completo"
                autoComplete="name"
              />
            </label>
            <label className="checkout-field">
              Company
              <input
                type="text"
                value={customer.company}
                onChange={(event) => set("company", event.target.value)}
                placeholder="Nome da empresa (opcional)"
                autoComplete="organization"
              />
            </label>
            <label className="checkout-field">
              Email *
              <input
                type="email"
                value={customer.email}
                onChange={(event) => set("email", event.target.value)}
                placeholder="email@dominio.com"
                autoComplete="email"
              />
            </label>
            <label className="checkout-field">
              Phone *
              <input
                type="tel"
                value={customer.phone}
                onChange={(event) => set("phone", event.target.value)}
                placeholder="+258 84 000 0000"
                autoComplete="tel"
              />
            </label>
            <label className="checkout-field">
              Address
              <input
                type="text"
                value={customer.address}
                onChange={(event) => set("address", event.target.value)}
                placeholder="Morada"
                autoComplete="street-address"
              />
            </label>
            <label className="checkout-field">
              Nuit
              <input
                type="text"
                value={customer.nuit}
                onChange={(event) => set("nuit", event.target.value)}
                placeholder="Número único de identificação tributária"
              />
            </label>
          </div>
          <div className="checkout-actions">
            <Link className="outline-button" href="/cart">
              ← Voltar ao carrinho
            </Link>
            <button className="button" type="button" onClick={next} disabled={!hasCustomerData()}>
              Continuar →
            </button>
          </div>
        </section>
      )}

      {/* Step: 02 Products */}
      {step === "Products" && (
        <section className="checkout-panel">
          <h2>02 · Products</h2>
          <p className="checkout-hint">Confirme os itens no seu carrinho.</p>
          <ul className="checkout-products">
            {items.map((item) => (
              <li key={`${item.kind}-${item.fullDomain}-${item.productId ?? ""}`}>
                <div>
                  <strong>
                    {item.category ? `${CATEGORY_ICON[item.category]} ` : ""}
                    {item.fullDomain || item.label}
                  </strong>
                  <span>
                    {item.fullDomain
                      ? item.label
                      : `${kindLabel(item.category ?? item.kind)} · ${periodLabel(item.period)}`}
                  </span>
                </div>
                <b>{fmt(item.price)} MT</b>
              </li>
            ))}
          </ul>
          <div className="checkout-total">
            <span>Total</span>
            <strong>{fmt(total)} MT</strong>
          </div>
          <CheckoutUpsell />
          <div className="checkout-actions">
            <button className="outline-button" type="button" onClick={back}>
              ← Voltar
            </button>
            <button className="button" type="button" onClick={next}>
              Continuar →
            </button>
          </div>
        </section>
      )}

      {/* Step: 03 Billing */}
      {step === "Billing" && (
        <section className="checkout-panel">
          <h2>03 · Billing</h2>
          <p className="checkout-hint">Confirme os dados de facturação.</p>
          <dl className="checkout-summary">
            <div><dt>Full Name</dt><dd>{customer.fullName}</dd></div>
            <div><dt>Company</dt><dd>{customer.company || "—"}</dd></div>
            <div><dt>Email</dt><dd>{customer.email}</dd></div>
            <div><dt>Phone</dt><dd>{customer.phone}</dd></div>
            <div><dt>Address</dt><dd>{customer.address || "—"}</dd></div>
            <div><dt>Nuit</dt><dd>{customer.nuit || "—"}</dd></div>
          </dl>
          <div className="checkout-total">
            <span>Total a pagar</span>
            <strong>{fmt(total)} MT</strong>
          </div>
          <CheckoutUpsell />
          <div className="checkout-actions">
            <button className="outline-button" type="button" onClick={back}>
              ← Voltar
            </button>
            <button className="button" type="button" onClick={next}>
              Continuar →
            </button>
          </div>
        </section>
      )}

      {/* Step: 04 Payment */}
      {step === "Payment" && (
        <section className="checkout-panel">
          <h2>04 · Payment</h2>
          <p className="checkout-hint">Escolha o método de pagamento.</p>
          <div className="payment-methods" role="radiogroup" aria-label="Método de pagamento">
            {PAYMENT_METHODS.map((provider) => (
              <label
                className={`payment-option ${method === provider.id ? "selected" : ""}`}
                key={provider.id}
              >
                <input
                  type="radio"
                  name="payment"
                  value={provider.id}
                  checked={method === provider.id}
                  onChange={() => setMethod(provider.id)}
                />
                <strong>{provider.name}</strong>
                <span>{provider.description}</span>
              </label>
            ))}
          </div>
          <div className="checkout-total">
            <span>Total a pagar</span>
            <strong>{fmt(total)} MT</strong>
          </div>
          <div className="checkout-actions">
            <button className="outline-button" type="button" onClick={back} disabled={processing}>
              ← Voltar
            </button>
            <button className="button" type="button" onClick={submitPayment} disabled={processing}>
              {processing ? "A processar…" : "Pagar agora"}
            </button>
          </div>
        </section>
      )}

      {/* Step: 05 Confirmation */}
      {step === "Confirmation" && (
        <section className="checkout-panel">
          <h2>05 · Confirmation</h2>
          {result && order ? (
            <div className="order-card">
              <div className="order-head">
                <div>
                  <span className="order-label">Order</span>
                  <h3>{order.id}</h3>
                </div>
                <span className="order-status">{order.status}</span>
              </div>

              <div className="order-block">
                <span className="order-label">Products</span>
                <ul className="order-products">
                  {order.items.map((item) => (
                    <li key={`${item.kind}-${item.fullDomain}-${item.productId ?? ""}`}>
                      <b className="order-kind">
                        {getProductKind(item)}
                      </b>
                      <span className="order-domain">
                        {item.category ? `${CATEGORY_ICON[item.category]} ` : ""}
                        {item.fullDomain || item.label}
                      </span>
                      <em>{fmt(item.price)} MT</em>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="order-block">
                <span className="order-label">Próximos passos</span>
                <ul className="order-steps">
                  {order.items.map((item) => (
                    <li
                      key={`${item.kind}-${item.fullDomain}-${item.productId ?? ""}`}
                      className="pending"
                    >
                      <span className="step-check">○</span>
                      {getProductKind(item)} · {item.fullDomain || item.label}
                    </li>
                  ))}
                </ul>
                <p className="checkout-hint">
                  Estado em direto disponível na página da encomenda.
                </p>
              </div>

              <p className="checkout-success">
                {result.message}
              </p>
              <p className="checkout-hint">
                Enviaremos a confirmação e as instruções por email para {order.customer?.email}.
              </p>
              <div className="checkout-actions">
                <Link className="button" href="/dashboard/orders">
                  Ver as minhas encomendas ↗
                </Link>
                <Link className="outline-button" href="/">
                  Voltar ao início
                </Link>
              </div>

              <CrossSellRecommendations offers={orderOffers} mode="cart" />
            </div>
          ) : (
            <p className="checkout-hint">A processar…</p>
          )}
        </section>
      )}
    </div>
  );
}
