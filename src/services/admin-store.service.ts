import { supabaseAdmin } from "@/lib/supabase-admin";
import { fail, type ServiceResult } from "@/services/result";
import { logAudit, AUDIT } from "@/lib/security/audit";
import { invalidateCatalogCache } from "@/lib/content";
import { serverLogError } from "@/lib/server-log";
import type { ProductCategory } from "@/lib/catalog-types";

/* --------------------------------------------------------------------- *
 * Admin store service.
 *
 * The admin catalog/CRM views used to live in `localStorage` (mock-only,
 * never persisted server-side). This service makes them DB-backed: every
 * store is a JSON value in `public.site_settings` (the same pattern used
 * for all content), RBAC-gated and audited on write.
 *
 * Best-effort live write-through:
 *  - `catalog`  -> products are upserted into `catalog_products` (the
 *                  relational source the public shop reads), so price /
 *                  feature / availability changes actually apply online.
 *                  Plans, coupons and categories are admin-only config.
 *  - `extensions` -> upserted into `domain_extensions` (registration,
 *                  renewal and availability feed checkout/domain lookup).
 *  - `hosting`, customers and all CRM stores persist to `site_settings`
 *                  only — there is no public consumer for those yet.
 * --------------------------------------------------------------------- */

const ADMIN_KINDS = new Set(["customers", "catalog", "extensions", "hosting"]);

export const ADMIN_STORE_KINDS = [
  "customers",
  "catalog",
  "extensions",
  "hosting",
  "leads",
  "companies",
  "contacts",
  "opportunities",
  "proposals",
  "projects",
  "communications",
  "notes",
] as const;

export type AdminStoreKind = (typeof ADMIN_STORE_KINDS)[number];

export type AdminStoreActor = {
  userId?: string;
  email?: string;
  role?: string;
};

function isAdminStoreKind(kind: unknown): kind is AdminStoreKind {
  return typeof kind === "string" && (ADMIN_STORE_KINDS as readonly string[]).includes(kind);
}

function storeKey(kind: AdminStoreKind): string {
  return ADMIN_KINDS.has(kind) ? `admin_${kind}` : `crm_${kind}`;
}

export async function getAdminStore(
  kind: unknown,
): Promise<ServiceResult<{ value: unknown; found: boolean }>> {
  if (!isAdminStoreKind(kind)) {
    return fail(400, "Armazenamento inválido.");
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", storeKey(kind))
      .maybeSingle();
    if (error) {
      serverLogError("service:adminStore.get", error);
      return fail(500, "Não foi possível carregar o armazenamento.");
    }
    return { ok: true, value: data?.value ?? null, found: data != null };
  } catch (e) {
    serverLogError("service:adminStore.get", e);
    return fail(500, "Não foi possível carregar o armazenamento.");
  }
}

type CatalogProductItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  period: string;
  features: string[];
  active: boolean;
};

const CATEGORY_MAP: Record<string, ProductCategory> = {
  websites: "website",
  ecommerce: "website",
  branding: "branding",
  marketing: "seo",
  domains: "domain",
  hosting: "hosting",
  email: "email",
  maintenance: "maintenance",
};

function catalogToRelational(value: unknown): Record<string, unknown>[] {
  const catalog = (value ?? {}) as { products?: CatalogProductItem[] };
  return (catalog.products ?? [])
    .filter((p) => p && typeof p === "object" && typeof p.id === "string")
    .map((p) => {
      const recurring = p.period !== "pagamento único";
      return {
        id: p.id,
        name: p.name,
        category: CATEGORY_MAP[p.category] ?? "website",
        type: recurring ? "recurring" : "one_time",
        price: Number.isFinite(p.price) ? p.price : 0,
        annual_price: p.period === "/ ano" ? p.price : null,
        currency: "MZN",
        description: "",
        features: Array.isArray(p.features) ? p.features : [],
        href: `/servicos?produto=${encodeURIComponent(p.id)}`,
        icon: null,
        meta: { admin_catalog: true, kind: "product", adminCategory: p.category },
        active: Boolean(p.active),
        sort: 0,
        for_services: [],
        for_pricing: [],
      };
    });
}

type ExtensionItem = {
  extension: string;
  register: number;
  renewal: number;
  available: boolean;
  suspended: boolean;
};

function extensionsToRelational(value: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(value) ? (value as ExtensionItem[]) : [];
  return rows
    .filter((e) => e && typeof e === "object" && typeof e.extension === "string")
    .map((e) => ({
      extension: e.extension,
      registration: Number.isFinite(e.register) ? e.register : 0,
      renewal: Number.isFinite(e.renewal) ? e.renewal : 0,
      active: Boolean(e.available) && !e.suspended,
    }));
}

async function syncRelational(kind: AdminStoreKind, value: unknown): Promise<void> {
  if (kind === "catalog") {
    const rows = catalogToRelational(value);
    if (rows.length === 0) return;
    try {
      const { error } = await supabaseAdmin
        .from("catalog_products")
        .upsert(rows, { onConflict: "id" });
      if (error) {
        serverLogError("service:adminStore.syncCatalog", error);
        return;
      }
      invalidateCatalogCache();
    } catch (e) {
      serverLogError("service:adminStore.syncCatalog", e);
    }
  }

  if (kind === "extensions") {
    const rows = extensionsToRelational(value);
    if (rows.length === 0) return;
    try {
      const { error } = await supabaseAdmin
        .from("domain_extensions")
        .upsert(rows, { onConflict: "extension" });
      if (error) {
        serverLogError("service:adminStore.syncExtensions", error);
      }
    } catch (e) {
      serverLogError("service:adminStore.syncExtensions", e);
    }
  }
}

export async function putAdminStore(
  kind: unknown,
  value: unknown,
  actor?: AdminStoreActor,
  ip?: string,
): Promise<ServiceResult<{ ok: true }>> {
  if (!isAdminStoreKind(kind)) {
    return fail(400, "Armazenamento inválido.");
  }
  if (value === null || value === undefined || typeof value !== "object") {
    return fail(400, "Valor inválido.");
  }

  try {
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: storeKey(kind), value }, { onConflict: "key" });
    if (error) {
      serverLogError("service:adminStore.put", error);
      return fail(500, "Não foi possível guardar o armazenamento.");
    }
  } catch (e) {
    serverLogError("service:adminStore.put", e);
    return fail(500, "Não foi possível guardar o armazenamento.");
  }

  await syncRelational(kind, value);

  await logAudit({
    action: AUDIT.SETTINGS_UPDATED,
    entity: storeKey(kind),
    entityId: kind,
    actorId: actor?.userId,
    actorEmail: actor?.email,
    actorRole: actor?.role,
    ip,
    meta: { source: "admin-store" },
  });

  return { ok: true };
}