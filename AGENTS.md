<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Critical Development Rules

1. Never build mockups only. Implement real functionality.
2. Do not use fake data where the functionality is already defined.
3. All configurable information must come from the database.
4. Never hard-code prices.
5. Never hard-code products.
6. Never hard-code clients.
7. Never place credentials in the frontend.
8. Use environment variables for secrets and configuration.

# Provisioning & Activation Pipeline

## Architecture Overview

The activation pipeline processes hosting and domain purchases after checkout payment. It uses a **job queue** (`provisioning_jobs` table) with idempotent, concurrent-cron-safe processing.

**Flow:** `Checkout → order + items + jobs (pending) → cron picks up → processors → order status: completed`

## Key Files

| File | Purpose |
|---|---|
| `src/lib/provisioning/jobs.ts` | Enqueue, claim, finalize jobs; recompute order status |
| `src/lib/activation.ts` | Process hosting/domain jobs (runs provisioning flows, updates DB rows) |
| `src/services/activation.service.ts` | Public entry point called by cron; returns `ServiceResult` |
| `src/app/api/cron/provisioning/route.ts` | Vercel cron (`*/5 * * * *`); guard with `CRON_SECRET` or `x-vercel-cron` header |
| `src/app/api/checkout/complete/route.ts` | Creates `hosting_accounts` (pending) + `domains` (pending) + jobs after payment |

## Database: provisioning_jobs

- **Columns:** `id uuid`, `kind hosting|domain`, `ref_id uuid`, `status pending|running|done|failed`, `attempts int`, `max_attempts int`, `last_error text`, `run_after timestamptz`, `created_at/updated_at`.
- **enqueue** → INSERT `pending`, `run_after = now()`.
- **claim** → UPDATE `pending → running WHERE id = x AND attempts = y` (optimistic lock).
- **finalize** → set `done/failed`, update `ref_id` table (hosting_accounts/domains), then call `recomputeOrderStatus`.
- **recomputeOrderStatus** → if ALL jobs for an order are `done` → order `completed`; if ANY `failed` → stays `processing` (manual retry possible via admin).
- Failed jobs retry with backoff: `2 min × attempts`, capped at 12 min. After `max_attempts` (default 5) → terminal `failed`.

## Hosted Plans — Credentials

These provider plans require **credentials — plan tokens NOT API keys** — and must be kept in `.env.local` (never committed):

```
# Hosting plan tokens (NOT API keys)
HOSTING_PLAN_TOKEN=...
DOMAIN_PLAN_TOKEN=...
```

The provisioning flows (`runHostingProvisioningFlow`, `runDomainProvisioningFlow`) read these tokens at runtime to authenticate with external providers.

## Checkout: Order Creation

`POST /api/checkout/complete` writes the whole commerce flow **atomically**:

1. **Server-side pricing (P1):** item prices are NEVER trusted from the client.
   Each item's price is re-derived from the DB — domain items from
   `domain_extensions` (`registration`/`renewal`), everything else from the
   relational `catalog_products` table via `catalogPrice(product, period)`
   (`catalog_products` feeds `getCatalogProductRows()` in `src/lib/content.ts`).
   Mismatching requests are rejected (`400`).
2. **Atomic write (P3):** one `complete_checkout` RPC call (SECURITY DEFINER,
   service-role only) inserts order → order_items → payment → domain
   registrations (+ `domain_orders` + provisioning job) → subscriptions (+
   `hosting_accounts` + provisioning job) in a single transaction. Any failure
   rolls everything back — zero orphan rows. Domain renewals are skipped (handled
   by the admin/domain-manager flow, not the provisioning cron).
3. **Order status:** the RPC sets the order to `processing` when any provisioning
   job was enqueued, otherwise it stays `paid`.
4. **Post-commit side effects** run in the route after the RPC succeeds:
   `logAudit(SUBSCRIPTION_CREATED)` + `notifyEvent("subscription.created")` per
   created subscription.
5. Returns `{ ok, orderId, number, total, pending }`.

**Hosting Configure step:** Catalog items with `category: hosting` or `email`
require the customer to enter a `fullDomain` during the Configure step. This is
stored as `product_fullDomain` in the cart item and passed as `fullDomain` to the
checkout route. Registered/reserved domains do not get a provisioning job.

## Activation Processors (src/lib/activation.ts)

### processHosting

1. Fetch `hosting_accounts` row by `ref_id`.
2. Fetch `hosting_plans` row by `plan_id` (may be null → defaults: 50 GB disk, 500 GB BW, 1 site, 10 email, 1 DB).
3. Resolve customer info from `orders.customer_id → profiles` or `payments.meta.customer`.
4. Call `runHostingProvisioningFlow(...)` — returns `{ ok, data: { username, passwordEncrypted, panelUrl, serverIp, nameservers } }`.
5. Update `hosting_accounts` → `status: active`, set creds, panel URL, server IP, nameservers, `provisioned_at`, `renews_at`.
6. Notify `hosting.activated`, audit `PROVISIONING_HOSTING`.

### processDomain

1. Fetch `domains` row by `ref_id`.
2. Call `runDomainProvisioningFlow(...)` — returns `{ ok, provider }`.
3. Update `domains` → `status: registered`, `registered_at`, `expires_at`, `registrar`.
4. Update `domain_orders` → `status: registered`.
5. Notify `domain.registered`, audit `PROVISIONING_DOMAIN`.

## Cron: /api/cron/provisioning

- Runs every 5 minutes (`vercel.json` cron entry).
- Guarded like billing cron: `x-vercel-cron: 1` header or `CRON_SECRET` bearer token.
- Calls `runActivationPipeline(20)` → processes up to 20 open jobs.
- Returns `{ ok, processed, succeeded, failed }`.

## Order Confirmation: /checkout/done

Server-rendered page that reads real DB state:
- `orders` by `order_id` (from `?id=` query param).
- `payments`, `order_items`, `hosting_accounts`, `domains`, `provisioning_jobs`.
- Renders activation steps (payment, hosting, domain) with truthful statuses.
- Auto-refreshes every 15s while any step is `pending` (via `OrderAutoRefresh` client component).

## Order Status Values

`pending` → `paid` (after payment) → `processing` (when jobs enqueued) → `completed` (all jobs done) or stays `processing` (if jobs failed, manual retry possible).

## Website Purchase Flow

1. `/websites` — public package listing (DB-driven from `service_packages`).
2. `/websites/brief` — customer fills brief form; `POST /api/website-brief` creates `projects` row (`status: brief`) + `proposals` row (`status: sent`, `project_id` set).
3. Admin reviews proposal at `/proposta/[token]`.
4. On approval (`proposal.service.ts decide()`): linked project status flips `brief → active`; notify `project.activated`; audit `PROJECT_ACTIVATED`.

## Dashboard: Project Statuses

`draft`, `published`, `archived`, `brief` (waiting for proposal approval), `active` (in progress), `on_hold`, `done`, `cancelled`.

Status labels in `projects-view.tsx`:
```
brief → "Em briefing"
active → "Em curso"
on_hold → "Em pausa"
done → "Concluído"
cancelled → "Cancelado"
```

## AI Website Builder (MVP + editor de secções)

Self-serve flow: **brief → gera no servidor → preview → edita secções → publica**.

### Arquitetura
- `builder_sites` (owner via `client_id` = auth `profiles.id`, como `projects.client_id`) + `builder_pages` (sections JSONB, unique `(site_id, slug)`), RLS: leitores só veem `published`, donos gerem os seus. Writes vão pelo `supabaseAdmin` (service role).
- `generateSite`/`rewriteSection` chamam o provedor de IA e GUARDAM o JSON no servidor — nunca no cliente. `replace_builder_pages` (RPC SECURITY DEFINER, service-role only) troca as páginas atomicamente na regeneração.
- Geração bem-sucedida cria também um `projects` (`category: website`, `status: draft`) ligado, por isso o site aparece em `/dashboard/websites`.

### Fluxo / ficheiros
1. `POST /api/ai-builder/sites` → `generateSite` → `chatJson(buildSitePrompt)` → `parseSitePayload` (normaliza/trunca) → `replace_builder_pages` → `builder_sites`=`ready` → audit `AI_SITE_GENERATED` + notificação `ai_site.generated`.
2. Editor (`/dashboard/ai-builder/[id]`): reordenar/editar/eliminar secções → `PATCH .../pages/[pageId]` → `saveSections` (valida com `parseSectionsInput`). Reescrever uma secção com IA → `POST .../sections/regenerate` → `rewriteSection` (mantém o `type` da secção).
3. `POST /api/ai-builder/sites/[id]/publish` → `publishSite` (exige `status=ready`) → audit `AI_SITE_PUBLISHED` + `ai_site.published`.
4. Preview público `/s/[id]/[[...slug]]` lê só sites `published` via service role; sem `slug` usa a página `inicio` (o parser obriga a primeira página ser `inicio`).

### Estado de `builder_sites.status`
`draft` → `generating` → `ready` → `published` (ou `failed`). `archived` não é usado ainda.

### IA provider-agnostic (env)
```
AI_API_KEY=…        # obrigatório; sem ela as rotas devolvem 503 claro
AI_BASE_URL=…       # default https://api.openai.com/v1
AI_MODEL=…          # default gpt-4o-mini
AI_TIMEOUT_MS=…     # default 120000
```
`src/lib/ai/provider.ts` usa `/chat/completions` com `response_format: json_object`. `chatJson`/`buildSitePrompt` são server-only.

### Secções suportadas (schema único: `src/lib/ai/builder-schema.ts`)
`hero, about, features, services, gallery, stats, testimonials, faq, cta, contact, footer, text`. O renderer (`src/components/ai-builder/site-renderer.tsx`) e o editor partilham estes tipos. Limites: ≤8 páginas, ≤12 secções/página, ≤12 items/lista, texto ≤2000 chars. O prompt ordena copy em pt-MZ e **nunca inventa preços** (`price_mt` só se o brief os der).
