import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AuthContext } from "@/lib/client";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/catalog-types";

export type ClientTicket = {
  id: string;
  number: string | null;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  channel: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    authorEmail: string | null;
    body: string;
    isInternal: boolean;
    createdAt: string;
  }>;
};

export type ClientInvoice = {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  discount: number;
  total: number;
  notes: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    description: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    taxRate: number;
  }>;
};

export type ClientProject = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  status: string;
  budget: number | null;
  startDate: string | null;
  deadline: string | null;
  tags: string[];
  createdAt: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueAt: string | null;
    completedAt: string | null;
  }>;
  comments: Array<{
    id: string;
    authorId: string | null;
    body: string;
    createdAt: string;
  }>;
};

export type ClientOrder = {
  id: string;
  fullDomain: string;
  extension: string;
  name: string;
  email: string;
  price: number | null;
  status: string;
  createdAt: string;
};

export type ClientPayment = {
  id: string;
  amount: number;
  currency: string;
  method: string | null;
  methodId: string | null;
  reference: string | null;
  status: string;
  description: string | null;
  orderId: string | null;
  canUploadProof: boolean;
  createdAt: string;
};

export async function listClientTickets(ctx: AuthContext): Promise<ClientTicket[]> {
  if (!ctx.userId) return [];

  const { data: tickets } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .or(`customer_id.eq.${ctx.userId},assignee_id.eq.${ctx.userId}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!tickets?.length) return [];

  const ticketIds = tickets.map((t) => t.id);
  const { data: allMessages } = await supabaseAdmin
    .from("ticket_messages")
    .select("*")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: true });

  const msgsByTicket = new Map<string, NonNullable<typeof allMessages>[number][]>();
  for (const msg of allMessages ?? []) {
    const key = String(msg.ticket_id);
    const list = msgsByTicket.get(key) ?? [];
    list.push(msg);
    msgsByTicket.set(key, list);
  }

  return tickets.map((t) => ({
    id: t.id,
    number: t.number,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    category: t.channel,
    channel: t.channel,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    messages: (msgsByTicket.get(String(t.id)) ?? []).map((m) => ({
      id: m.id,
      authorEmail: m.author_email,
      body: m.body,
      isInternal: m.is_internal,
      createdAt: m.created_at,
    })),
  }));
}

export async function listClientInvoices(ctx: AuthContext): Promise<ClientInvoice[]> {
  if (!ctx.userId) return [];

  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("customer_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!invoices?.length) return [];

  const invoiceIds = invoices.map((i) => i.id);
  const { data: allItems } = await supabaseAdmin
    .from("invoice_items")
    .select("*")
    .in("invoice_id", invoiceIds)
    .order("created_at", { ascending: true });

  const itemsByInvoice = new Map<string, NonNullable<typeof allItems>[number][]>();
  for (const item of allItems ?? []) {
    const key = String(item.invoice_id);
    const list = itemsByInvoice.get(key) ?? [];
    list.push(item);
    itemsByInvoice.set(key, list);
  }

  return invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    currency: inv.currency,
    subtotal: Number(inv.subtotal ?? 0),
    taxRate: Number(inv.tax_rate ?? 15),
    discount: Number(inv.discount ?? 0),
    total: Number(inv.total ?? 0),
    notes: inv.notes,
    issuedAt: inv.issued_at,
    dueAt: inv.due_at,
    paidAt: inv.paid_at,
    createdAt: inv.created_at,
    items: (itemsByInvoice.get(String(inv.id)) ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      qty: item.qty,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
      taxRate: Number(item.tax_rate),
    })),
  }));
}

export async function listClientProjects(ctx: AuthContext): Promise<ClientProject[]> {
  if (!ctx.userId) return [];

  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("client_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!projects?.length) return [];

  const projectIds = projects.map((p) => p.id);
  const [tasksRes, commentsRes] = await Promise.all([
    supabaseAdmin
      .from("project_tasks")
      .select("*")
      .in("project_id", projectIds)
      .order("sort", { ascending: true }),
    supabaseAdmin
      .from("project_comments")
      .select("*")
      .in("project_id", projectIds)
      .order("created_at", { ascending: true }),
  ]);

  const tasksByProject = new Map<string, NonNullable<typeof tasksRes.data>[number][]>();
  for (const task of tasksRes.data ?? []) {
    const key = String(task.project_id);
    const list = tasksByProject.get(key) ?? [];
    list.push(task);
    tasksByProject.set(key, list);
  }

  const commentsByProject = new Map<string, NonNullable<typeof commentsRes.data>[number][]>();
  for (const c of commentsRes.data ?? []) {
    const key = String(c.project_id);
    const list = commentsByProject.get(key) ?? [];
    list.push(c);
    commentsByProject.set(key, list);
  }

  return projects.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    category: p.category,
    status: p.status,
    budget: p.budget ? Number(p.budget) : null,
    startDate: p.start_date,
    deadline: p.deadline,
    tags: p.tags ?? [],
    createdAt: p.created_at,
    tasks: (tasksByProject.get(String(p.id)) ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueAt: t.due_at,
      completedAt: t.completed_at,
    })),
    comments: (commentsByProject.get(String(p.id)) ?? []).map((c) => ({
      id: c.id,
      authorId: c.author_id,
      body: c.body,
      createdAt: c.created_at,
    })),
  }));
}

export async function listClientOrders(ctx: AuthContext): Promise<ClientOrder[]> {
  if (!ctx.userId && !ctx.email) return [];

  const { data: orders } = await supabaseAdmin
    .from("domain_orders")
    .select("*")
    .or(`user_id.eq.${ctx.userId ?? "''"},email.eq.${ctx.email ?? "''"}`)
    .order("created_at", { ascending: false })
    .limit(50);

  return (orders ?? []).map((o) => ({
    id: o.id,
    fullDomain: o.full_domain,
    extension: o.extension,
    name: o.name,
    email: o.email,
    price: o.price ? Number(o.price) : null,
    status: o.status,
    createdAt: o.created_at,
  }));
}

export async function listClientPayments(ctx: AuthContext): Promise<ClientPayment[]> {
  if (!ctx.userId) return [];

  const { data: payments } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("customer_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const METHOD_LABEL: Record<string, string> = {
    mpesa: "M-Pesa",
    emola: "e-Mola",
    mkesh: "mKesh",
    card: "Cartão",
    visa: "Visa",
    mastercard: "Mastercard",
    bank_transfer: "Transferência bancária",
    "bank-transfer": "Transferência bancária",
    cash: "Numerário",
  };
  const PROOF_METHODS = new Set(["mpesa", "emola", "mkesh", "bank-transfer", "bank_transfer", "cash"]);

  return (payments ?? []).map((p) => {
    const methodId = p.method ? String(p.method) : null;
    return {
      id: p.id,
      amount: Number(p.amount ?? 0),
      currency: p.currency ?? "MZN",
      method: methodId ? (METHOD_LABEL[methodId] ?? methodId) : null,
      methodId,
      reference: p.reference,
      status: p.status,
      description: p.meta && typeof p.meta === "object" && "description" in p.meta
        ? String((p.meta as Record<string, unknown>).description)
        : "Pagamento",
      orderId: p.order_id ?? null,
      canUploadProof: p.status === "pending" && !!methodId && PROOF_METHODS.has(methodId),
      createdAt: p.created_at,
    };
  });
}

export async function countClientItems(ctx: AuthContext): Promise<{
  domains: number;
  tickets: number;
  invoices: number;
  projects: number;
  orders: number;
  hosting: number;
  email: number;
}> {
  if (!ctx.userId) return { domains: 0, tickets: 0, invoices: 0, projects: 0, orders: 0, hosting: 0, email: 0 };

  const [ticketsRes, invoicesRes, projectsRes, ordersRes, hostingRes, emailRes] = await Promise.all([
    supabaseAdmin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", ctx.userId),
    supabaseAdmin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", ctx.userId),
    supabaseAdmin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("client_id", ctx.userId),
    supabaseAdmin
      .from("domain_orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId),
    supabaseAdmin
      .from("hosting_accounts")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", ctx.userId),
    supabaseAdmin
      .from("email_services")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", ctx.userId),
  ]);

  return {
    domains: ordersRes.count ?? 0,
    tickets: ticketsRes.count ?? 0,
    invoices: invoicesRes.count ?? 0,
    projects: projectsRes.count ?? 0,
    orders: ordersRes.count ?? 0,
    hosting: hostingRes.count ?? 0,
    email: emailRes.count ?? 0,
  };
}

export type ClientHostingAccount = {
  id: string;
  domain: string | null;
  username: string | null;
  status: string;
  quotaGb: number;
  provisionedAt: string | null;
  renewsAt: string | null;
  createdAt: string;
};

export async function listClientHostingAccounts(ctx: AuthContext): Promise<ClientHostingAccount[]> {
  if (!ctx.userId) return [];

  const { data } = await supabaseAdmin
    .from("hosting_accounts")
    .select("*")
    .eq("customer_id", ctx.userId)
    .order("created_at", { ascending: true })
    .limit(50);
  return (data ?? []).map((h) => ({
    id: h.id,
    domain: h.domain,
    username: h.username,
    status: h.status,
    quotaGb: h.quota_gb ?? 0,
    provisionedAt: h.provisioned_at,
    renewsAt: h.renews_at,
    createdAt: h.created_at,
  }));
}

export type ClientEmailService = {
  id: string;
  domain: string;
  planName: string;
  status: string;
  dnsStatus: string;
  mailboxLimit: number;
  storageLimitGb: number;
  expiresAt: string | null;
  createdAt: string | null;
  providerLabel: string | null;
};

export async function listClientEmailServices(ctx: AuthContext): Promise<ClientEmailService[]> {
  if (!ctx.userId) return [];

  const { data } = await supabaseAdmin
    .from("email_services")
    .select("id, domain, plan_name, status, dns_status, mailbox_limit, storage_limit_gb, expires_at, created_at, meta")
    .eq("customer_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((row) => ({
    id: row.id,
    domain: row.domain,
    planName: row.plan_name,
    status: row.status,
    dnsStatus: row.dns_status,
    mailboxLimit: Number(row.mailbox_limit ?? 0),
    storageLimitGb: Number(row.storage_limit_gb ?? 0),
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at ?? null,
    providerLabel:
      row.meta && typeof row.meta === "object" && "providerLabel" in row.meta
        ? String((row.meta as Record<string, unknown>).providerLabel ?? "")
        : null,
  }));
}

export type ClientEmailAutoresponder = {
  enabled: boolean;
  subject: string;
  body: string;
  fromName: string | null;
  fromDate: string | null;
  toDate: string | null;
} | null;

export type ClientEmailMailbox = {
  id: string;
  emailAddress: string;
  displayName: string | null;
  status: string;
  storageLimitGb: number;
  storageUsedGb: number;
  quotaPercent: number;
  accessedAt: string | null;
  createdAt: string | null;
  forwardTo: string[];
  autoresponder: ClientEmailAutoresponder;
};

export type ClientEmailAlias = {
  id: string;
  aliasAddress: string;
  destination: string;
  status: string;
  createdAt: string | null;
};

export type ClientEmailServiceDetail = ClientEmailService & {
  providerMode: string | null;
  mailboxes: ClientEmailMailbox[];
  aliases: ClientEmailAlias[];
  usage: { storageUsedGb: number; mailboxesUsed: number };
};

export async function getClientEmailService(
  ctx: AuthContext,
  serviceId: string,
): Promise<ClientEmailServiceDetail | null> {
  if (!ctx.userId) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId)) return null;

  const { data } = await supabaseAdmin
    .from("email_services")
    .select("id, domain, plan_name, status, dns_status, mailbox_limit, storage_limit_gb, expires_at, created_at, meta")
    .eq("id", serviceId)
    .eq("customer_id", ctx.userId)
    .maybeSingle();
  if (!data) return null;

  const [mailboxesRes, aliasesRes, usageRes] = await Promise.all([
    supabaseAdmin
      .from("email_mailboxes")
      .select("id, email_address, display_name, status, storage_limit_gb, storage_used_gb, quota_percent, accessed_at, created_at, forward_to, autoresponder")
      .eq("email_service_id", serviceId)
      .not("status", "eq", "deleted")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("email_aliases")
      .select("id, alias_address, destination, status, created_at")
      .eq("email_service_id", serviceId)
      .not("status", "eq", "deleted")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("email_usage")
      .select("storage_used_gb, mailboxes_used")
      .eq("email_service_id", serviceId)
      .order("recorded_at", { ascending: false })
      .limit(1),
  ]);

  const meta = (data.meta ?? {}) as Record<string, unknown>;
  const usageRow = (usageRes.data?.[0] ?? {}) as Record<string, unknown>;

  const toMailbox = (m: Record<string, unknown>): ClientEmailMailbox => {
    const forwardRaw = Array.isArray(m.forward_to) ? m.forward_to : [];
    const autoresponderRaw =
      m.autoresponder && typeof m.autoresponder === "object" ? (m.autoresponder as Record<string, unknown>) : null;
    return {
      id: String(m.id),
      emailAddress: String(m.email_address),
      displayName: m.display_name ? String(m.display_name) : null,
      status: String(m.status),
      storageLimitGb: Number(m.storage_limit_gb ?? 0),
      storageUsedGb: Number(m.storage_used_gb ?? 0),
      quotaPercent: Number(m.quota_percent ?? 0),
      accessedAt: m.accessed_at ? String(m.accessed_at) : null,
      createdAt: m.created_at ? String(m.created_at) : null,
      forwardTo: forwardRaw.map((v: unknown) => String(v)),
      autoresponder: autoresponderRaw
        ? {
            enabled: autoresponderRaw.enabled === true,
            subject: String(autoresponderRaw.subject ?? ""),
            body: String(autoresponderRaw.body ?? ""),
            fromName: typeof autoresponderRaw.fromName === "string" ? autoresponderRaw.fromName : null,
            fromDate: typeof autoresponderRaw.fromDate === "string" ? autoresponderRaw.fromDate : null,
            toDate: typeof autoresponderRaw.toDate === "string" ? autoresponderRaw.toDate : null,
          }
        : null,
    };
  };

  return {
    id: data.id,
    domain: data.domain,
    planName: data.plan_name,
    status: data.status,
    dnsStatus: data.dns_status,
    mailboxLimit: Number(data.mailbox_limit ?? 0),
    storageLimitGb: Number(data.storage_limit_gb ?? 0),
    expiresAt: data.expires_at ?? null,
    createdAt: data.created_at ?? null,
    providerLabel: typeof meta.providerLabel === "string" ? meta.providerLabel : null,
    providerMode: typeof meta.providerMode === "string" ? meta.providerMode : null,
    mailboxes: (mailboxesRes.data ?? []).map(toMailbox),
    aliases: (aliasesRes.data ?? []).map((a) => ({
      id: String(a.id),
      aliasAddress: String(a.alias_address),
      destination: String(a.destination),
      status: String(a.status),
      createdAt: a.created_at ? String(a.created_at) : null,
    })),
    usage: {
      storageUsedGb: Number(usageRow.storage_used_gb ?? 0),
      mailboxesUsed: Number(usageRow.mailboxes_used ?? 0),
    },
  };
}

export type ClientEmailDnsValue = {
  type: string;
  name: string;
  value: string;
  priority: number | null;
};

export type ClientEmailDnsRecord = {
  id: string;
  recordType: string;
  status: string;
  value: ClientEmailDnsValue | null;
  selector: string | null;
  lastCheckedAt: string | null;
};

export type ClientEmailDnsBundle = {
  service: { id: string; domain: string; dnsStatus: string };
  records: ClientEmailDnsRecord[];
};

export async function getClientEmailDns(
  ctx: AuthContext,
  serviceId: string,
): Promise<ClientEmailDnsBundle | null> {
  if (!ctx.userId) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId)) return null;

  const { data } = await supabaseAdmin
    .from("email_services")
    .select("id, domain, dns_status")
    .eq("id", serviceId)
    .eq("customer_id", ctx.userId)
    .maybeSingle();
  if (!data) return null;

  const { data: records } = await supabaseAdmin
    .from("email_dns_configs")
    .select("id, record_type, status, value, selector, last_checked_at")
    .eq("email_service_id", serviceId)
    .order("record_type", { ascending: true });

  return {
    service: {
      id: String(data.id),
      domain: String(data.domain ?? ""),
      dnsStatus: String(data.dns_status ?? "pending"),
    },
    records: (records ?? []).map((r) => {
      const raw = r as Record<string, unknown>;
      const value =
        raw.value && typeof raw.value === "object"
          ? (raw.value as Record<string, unknown>)
          : null;
      return {
        id: String(raw.id),
        recordType: String(raw.record_type ?? ""),
        status: String(raw.status ?? "pending"),
        value: value
          ? {
              type: String(value.type ?? "TXT"),
              name: String(value.name ?? ""),
              value: String(value.value ?? ""),
              priority: value.priority == null ? null : Number(value.priority),
            }
          : null,
        selector: raw.selector ? String(raw.selector) : null,
        lastCheckedAt: raw.last_checked_at ? String(raw.last_checked_at) : null,
      };
    }),
  };
}

/**
 * Distinct product categories the customer owns, built from real commerce and
 * service tables owned by the current user. Used to drive the cross-sell
 * engine ("what's the natural next step?").
 */
export async function listClientOwnedCategories(ctx: AuthContext): Promise<ProductCategory[]> {
  if (!ctx.userId) return [];
  const owned = new Set<ProductCategory>();

  const [domainsRes, hostingRes, projectsRes, ordersRes] = await Promise.all([
    supabaseAdmin
      .from("domain_orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId),
    supabaseAdmin
      .from("hosting_accounts")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", ctx.userId),
    supabaseAdmin
      .from("projects")
      .select("category, id")
      .eq("client_id", ctx.userId),
    supabaseAdmin
      .from("orders")
      .select("id")
      .eq("customer_id", ctx.userId),
  ]);

  if ((domainsRes.count ?? 0) > 0) owned.add("domain");
  if ((hostingRes.count ?? 0) > 0) owned.add("hosting");

  const PROJECT_TO_CATEGORY: Record<string, ProductCategory> = {
    website: "website",
    branding: "branding",
    software: "software",
    design: "design",
  };
  for (const p of projectsRes.data ?? []) {
    const cat = PROJECT_TO_CATEGORY[String((p as { category?: unknown }).category ?? "")];
    if (cat) owned.add(cat);
  }

  const orderIds = (ordersRes.data ?? []).map((o) => (o as { id: string }).id);
  if (orderIds.length > 0) {
    const { data: orderItems } = await supabaseAdmin
      .from("order_items")
      .select("kind, meta")
      .in("order_id", orderIds);
    for (const item of orderItems ?? []) {
      const meta = (item as { meta?: Record<string, unknown> }).meta;
      const kindCat = typeof meta?.category === "string" ? (meta.category as ProductCategory) : null;
      if (kindCat && PRODUCT_CATEGORIES.includes(kindCat)) {
        owned.add(kindCat);
      } else {
        const kind = String((item as { kind?: unknown }).kind ?? "");
        if (kind === "hosting") owned.add("hosting");
        if (kind === "domain") owned.add("domain");
      }
    }
  }

  return PRODUCT_CATEGORIES.filter((cat) => owned.has(cat)).sort(
    (a, b) => PRODUCT_CATEGORIES.indexOf(a) - PRODUCT_CATEGORIES.indexOf(b),
  );
}