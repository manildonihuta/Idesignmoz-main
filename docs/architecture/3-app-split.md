# Split em 3 apps — Plano de implementação

> Estado: **planeado**. Executar quando entra a primeira feature nova de plataforma
> (reseller hosting, afiliados, marketplace ou AI Website Builder). O monólito
> continua a ser a fonte da verdade até lá.

## 1. Decisões aprovadas

1. **Âmbito imediato**: planear agora, codificar quando o reseller chegar.
2. **Segurança**: a chave `service_role` fica **só no core/backend**. As apps web,
   portal e admin autenticam utilizadores e fazem queries via **RLS**; operações
   críticas (checkout, provisioning, fatturação) só através de **RPCs Postgres**
   definidos no core.
3. **Auth/SSO**: **Supabase Auth central** + cookies de sessão partilhados por
   domínio. Website sem login obrigatório; portal/admin com gates próprios. O
   stack actual já usa `createSupabaseServerClient` (`/api/auth/*`) — o NextAuth
   (`src/auth.ts`, `[...nextauth]`, adapter Prisma) está **órfão** e deve ser
   descontinuado no split.

## 2. Topologia

```
        ┌──────────────────────────── Supabase (1 projecto) ───────────────────────────┐
        │  anon RLS (vendas/public)  ·  cliente RLS (dashboard)  ·  staff RLS (CRM)     │
        │  RPCs transaccionais: complete_checkout, provisioning, billing lifecycle,    │
        │  domain-manager, analytics — único ponto de escrita crítico                  │
        └───────────────▲──────────────────────────────▲───────────────────────────────┘
                        │                              │
        ┌───────────────┴───────────┐   ┌──────────────┴───────────────┐
        │  apps/web  (marketing)    │   │  apps/portal  (dashboard)    │
        │  · páginas públicas       │   │  · domínios/hosting/email    │
        │  · catálogo/carrinho      │   │  · projetos/pagamentos/fat.  │
        │  · checkout (RPC)         │   │  · subscrições/tickets       │
        └───────────────▲───────────┘   └──────────────▲───────────────┘
                        │                              │
        ┌───────────────┴──────────────────────────────┴───────────────┐
        │  packages/core  — types, DTOs, serviços, schema-RLS, RPCs    │
        │  packages/ui     — design system (Tailwind 4)                │
        │  one shared Supabase project; contratos via DB + RPC + DTOs  │
        └──────────────────────────────────────────────────────────────┘

        apps/admin  (CRM interno) — gestão, reseller, afiliados, marketplace
```

- **Nenhum app chama a pasta `src` de outro.** Tudo o que é lógica de negócio,
  tipos e DTOs vive em `packages/core`; UI partilhada em `packages/ui`.
- Redeploy de `apps/web` não pode quebrar o portal e vice-versa.

## 3. Layout do monorepo

```
apps/
  web/      Next 16 (marketing + catálogo + checkout; auth opcional)
  portal/   Next 16 (dashboard cliente; auth obrigatória, SSR)
  admin/    Next 16 (operações internas; RBAC staff, sessão via userId+role)
packages/
  core/     types + DTOs + serviços (billing, provisioning, domain, crm, analytics)
            + helpers RLS/RPC (clientes por tenant)  — compilado TS, consumido pelas 3 apps
  ui/       componentes partilhados (button, forms, tabelas, modal)
  config/   eslint, tsconfig, tailwind presets
  db/       migrations + seed + tipos gerados (Supabase)
infra/      vercel.json por app, cron definitions, .env.example
```

Decisão de tooling em aberto (não bloqueante): **pnpm/turbo** (recomendado para
monorepo) vs **npm workspaces**; caminho `/@/*` → `@idesignmoz/core` via
`paths` do tsconfig de cada app.

## 4. Contratos entre apps

1. **DB é o contrato**: schema via migrações em `packages/db`; todas as apps
   apontam ao mesmo projecto Supabase.
2. **Escritas críticas** só via RPC (`complete_checkout`, jobs de provisioning,
   lifecycle billing, domain-manager, analytics). Já começado:
   `supabase/migrations/20260909010000_architecture_scale.sql`.
3. **Leituras** com RLS: nenhum `service_role` no edge runtime das apps. staff
   vs cliente distinguido por role na sessão (`public.profiles.role` /
   `public.users`, RBAC já em `src/lib/security/rbac`).
4. DTOs partilhados em `packages/core` (ex.: `ClientSubscription`,
   `CartItem`, `CheckoutResult`) — copiados do `src/lib/*` actual.

## 5. Auth/SSO

- **Supabase Auth** é o único sistema de identidade (clientes + staff). Cookie de
  sessão é setado pelo `createBrowserClient`/`createServerClient` de
  `@supabase/ssr` (já usado via `src/lib/supabase-server.ts`).
- Cookies **partilhados pelo domínio** (ex.: `portal.idesignmoz.com` e
  `admin.idesignmoz.com` num parent domain) permitem que um login valha nas 3
  apps; cada app tem o seu gate (web = opcional, portal = cliente, admin = staff).
- **Descontinuar NextAuth/Prisma** no split (hoje só `src/auth.ts` +
  `[...nextauth]`, não usado pelo cliente; Prisma mantém-se só para tooling ou é
  removido).

## 6. Segurança / credenciais

| Segredo | Onde vive |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | apenas em deploy do `packages/core`-backed worker/edge (ou longe das apps) |
| `ANON_PUBLIC_KEY` | nas 3 apps (leituras com RLS) |
| `CRON_SECRET`, `RESEND_API_KEY`, plan tokens (hosting/domain) | `.env.local` + Vercel por app; nunca no client |

Regra mantida do AGENTS.md: sem credenciais no frontend; preços e produtos só do
DB (catálogo relacional já implementado).

## 7. Migração faseada (para executar quando o reseller entrar)

Pré-requisitos **já concluídos** no monólito:
- Catálogo relacional `catalog_products` + loader em `src/lib/content.ts`.
- `complete_checkout()` RPC atómico + re-pricing server-side em
  `src/app/api/checkout/complete/route.ts`.
- Indexes de escala (subscriptions/domains/orders/payments).

Fases:
1. **Fase 1 — skeleton monorepo**: `apps/web` clonado do monólito (mesmo
   `src/app`), `packages/core` com types+DTOs, CI/lint partilhado. Sem mudança
   funcional.
2. **Fase 2 — bordejar o core**: mover `src/services/*`, `src/lib/*` (billing,
   provisioning, domain, crm, conteúdo) para `packages/core`; apps importam por
   `@idesignmoz/core`. Testes (Vitest) movem-se junto.
3. **Fase 3 — apps/web**: só páginas públicas + catálogo + checkout + conteúdo;
   remove do `src` tudo o que seja dashboard/domínio admin. Primeiro corte.
4. **Fase 4 — apps/portal**: migrate `/dashboard/*` + `api/client|payments|tickets`.
   Auth gate cliente; RLS cliente.
5. **Fase 5 — apps/admin**: migrate `/admin/*` + `api/admin|api/cron|api/provisioning`.
   RBAC staff; aqui entra reseller/afiliados/marketplace como novos módulos.
6. **Fase 6 — decommission**: apagar rotas/API duplicadas no monólito; remover
   NextAuth/Prisma; apontar DNS das apps.

Regra de paridade: cada app só promove quando o equivalente no monólito puder
ser removido sem regressão (verificado por testes Vitest que já cobrem seed e
serviços).

## 8. Riscos e decisões em aberto

- **Domínio cookies**: subdomínio partilhado vs 1º nível (`.idesignmoz.com`) —
  precisa root domain; se apps em domínios separados, exigir token de sessão
  cross-app (mais trabalho).
- **Deploy**: cada app em separado na Vercel (site estático força revisão do
  `next build --webpack`); crons só na app admin/core-worker.
- **`site_settings` (content JSON)**: continua a viver no DB; ler de
  `packages/core` (loader já feito); o website é o único consumidor principal.
- **Prisma/NextAuth**: remover no split; hoje não alimentam o fluxo do cliente.
- **Testes E2E**: sem E2E hoje; com 3 apps, adicionar um smoke test por app
  (checkout web → portal mostra encomenda → admin vê o pedido).
- **Performance**: `apps/web` deve ficar static-friendly (menos queries de
  auth); páginas de catálogo já são data-driven com TTL de cache.

## 9. Checklist para quando o reseller chegar (ordem de execução)

1. Confirmar decisões em aberto (tooling, domínio cookies, deploy).
2. Fase 1 (skeleton monorepo) — sem mudança funcional.
3. Fase 2 (bordejamento `packages/core`).
4. Adicionar reseller/affiliates **como novos módulos no `packages/core` + admin**,
   não como rotas novas no monólito (é aqui que o split passa a valer a pena).
5. Só depois: Fases 3–6 (cortar apps do monólito).