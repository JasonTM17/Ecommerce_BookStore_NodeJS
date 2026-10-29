# Hosting Readiness — backend-node (NestJS 11 + TypeORM)

Date: 2026-10-28. Scope: `backend-node/**` only.
Second worker pass: dependency repair, Vercel/Supabase runtime adaptation,
checkout-flow integration proof. All commands run in `backend-node/` unless
noted. Vercel entrypoint model per
<https://vercel.com/docs/frameworks/backend/nestjs> and
<https://vercel.com/kb/guide/ship-a-nestjs-app-on-vercel>.

## 1. Dependency repair (requirement 1)

`npm install` was run against the public registry and `package-lock.json`
regenerated. The previous session's stall was caused by a nonexistent
`class-validator@0.15.3` pin — corrected to `^0.15.1` (real latest 0.15.x).

Changes vs the stalled package.json:

| Change | Reason |
|---|---|
| `class-validator ^0.15.3 → ^0.15.1` | 0.15.3 does not exist in the registry |
| removed `@types/bcryptjs` | bcryptjs 3.x bundles its own `umd/index.d.ts` |
| added `express ^5.2.1` | code imports `json/urlencoded` directly; Nest 11 keeps express as a peer, it nested under `node_modules/@nestjs/platform-express` and `dist/main.js` could not resolve it |
| added `overrides.multer ^2.5.0` | `multer 2.0.0–2.4.0` HIGH advisory (GHSA-q7qp-rjg7-q26m); `@nestjs/platform-express@11.2.8` pins `multer@2.4.0` exactly; no 11.x fix exists |
| added `overrides.js-yaml ^5.4.1` | `js-yaml 5.0.0–5.4.0` MODERATE advisory (GHSA-r3ph-w7gj-g6xm); `@nestjs/swagger@11.4.7` pins `js-yaml@5.3.0` exactly |

No `npm audit fix --force`, no weakened gates, no hidden advisories.
Supabase Storage is implemented over plain HTTPS `fetch` — zero new runtime
dependencies (`@supabase/storage-js@2.118.0` was rejected: pulls an
unrelated `iceberg-js` dependency).

| Command | Exit | Result |
|---|---|---|
| `npm audit --omit=dev` | 0 | **0 vulnerabilities** (was 12 high / 5 moderate) |
| `npm audit` (incl. dev) | 1 | 9 LOW residual — `deepmerge` inside the jest/ts-jest toolchain only; no runtime impact, no non-forced fix published |

## 2. Vercel / pooled-Postgres runtime (requirement 2)

- `src/main.ts` remains the detected entrypoint (conventional name under
  `src/`). It now builds the app through a lazy `getApp()` promise so the
  Nest instance is created once per warm instance. The default export is a
  cached `(req,res)` handler (`getHttpHandler()` → `app.init()` once →
  Express instance reused). `bootstrap()` + `app.listen()` run only when the
  file is executed directly (`node dist/main.js`, `nest start`), so local
  startup is unchanged and both Vercel invocation models work.
- All guards/filters/pipes/CORS/rate-limit/security headers/roles/ownership
  are configured inside `createApp()` and apply identically in both models.
- `DATABASE_URL` is supported: `postgresql://user:pass@host:port/db`
  (+ optional `?sslmode=require` → TLS `rejectUnauthorized`, overridable via
  `DB_SSL_REJECT_UNAUTHORIZED=false`). Its fields override individual
  `DB_*` vars; explicit `DB_TYPE` still wins. Verified against a Supabase
  pooler-shaped URL (`…pooler.supabase.com:6543`, dotted user, encoded
  password) — parsed correctly.
- Pool bounds: `DB_POOL_MAX` (default **5**), `DB_POOL_IDLE_TIMEOUT_MS`
  (10s), `DB_POOL_CONNECTION_TIMEOUT_MS` (10s) → `pg.Pool` `extra` options
  (mysql2 `connectionLimit`/`connectTimeout` equivalent).
- `DB_SYNCHRONIZE` now defaults to **false in production** (explicit
  `DB_SYNCHRONIZE=true` still honored as an opt-in; dev/test default stays
  true). Verified: `NODE_ENV=production` unset → `false`, explicit → `true`.
- Fresh-DB setup command: `npm run db:setup`
  (`ts-node src/database/setup-db.ts`). Forces `synchronize:true` for that
  run only — proved on a brand-new empty database: **33 tables created**
  with runtime `DB_SYNCHRONIZE=false`. Use once per new environment; do NOT
  enable runtime sync for it.
- `node dist/main.js` smoke against real Postgres with
  `DB_SYNCHRONIZE=false`: `/api/health/live`, `/api/health/ready`,
  `/api/swagger-ui.html` all 200 — production-shape boot verified.
- Function-model smoke: supertest over `require('dist/main.js').default`
  served `/api/health/live`, `/api/health/ready`, `/api/products` 200 — the
  cached handler works and every `/api` route is mapped.

## 3. Supabase Storage (requirement 3)

- `src/modules/files/file-store.ts`: `FileStore` interface with
  `LocalFileStore` (unchanged disk behavior → `/api/uploads/<name>.ext`) and
  `SupabaseFileStore` (plain REST: `POST|DELETE
  {SUPABASE_URL}/storage/v1/object/{bucket}/{name}`; returns
  `…/object/public/{bucket}/{name}`).
- `FileService` keeps all existing validation (jpg/jpeg/png/gif/webp,
  extension↔MIME match, size `UPLOAD_MAX_FILE_SIZE`, count
  `UPLOAD_MAX_FILES`) and selects the upload driver via `STORAGE_DRIVER`
  (`local` default / `supabase`). Delete routes by URL shape, so local URLs
  still delete from disk after a driver switch.
- Service-role key is server-side only (`SUPABASE_SERVICE_ROLE_KEY` read via
  ConfigService; never returned in responses). Bucket is the public asset
  bucket `SUPABASE_STORAGE_BUCKET` (default `uploads`). Upload endpoints
  remain `ADMIN`/`MANAGER`-only.
- Honest failure: unconfigured supabase driver throws
  `ServiceUnavailableException` — no fabricated URLs. Failure surfaces as
  `4xx` with the storage status code, never a fake success.
- Unit spec `file-store.spec.ts` pins: no-config rejection, `owns()` prefix
  matching, and `..` traversal rejection on delete.
- NOT_RUN: real Supabase project round-trip (no credentials in this
  workspace; controller owns provisioning). Local-store HTTP path is fully
  E2E-tested; Supabase paths are code+unit verified only.

## 4. Integration coverage (requirement 4)

New `test/integration/checkout-flow.spec.ts` — real HTTP (supertest) +
real Postgres, full app:

| Case | Assertion |
|---|---|
| full checkout | register→cart add→GET cart totals→POST /api/orders 201; server totals `subtotal 120000 / shippingFee 25000 / tax 12000 / total 157000`; stock 10→8; cart cleared; appears in GET /api/orders |
| ownership | user B GET `/api/orders/{id}` of A → 400/403; B's list excludes it |
| flash pricing | active FlashSale row → order item price 45000 (not 60000); `sold_count`+1; `max_per_user` breach → 400 |
| rollback | qty 2 vs stock 1 → 400; **zero** order rows for user; stock unchanged; cart item preserved |
| concurrency | two parallel POST /api/orders on last unit → `[201,400]`; stock exactly 0; exactly one order_items row |
| refresh negatives | rotate → 200 new pair; replay of rotated token → 4xx; garbage → 4xx; new token → 200 |
| uploads | no-auth 401; customer role 401/403; admin PNG → 201 with `/api/uploads/…` URL; wrong MIME → 400; admin DELETE → 200 |

The direct `decrementStock` concurrency spec is kept but is NOT claimed as
checkout-atomicity proof — the concurrent-HTTP-checkout case above covers
that claim now. `docs/api-parity.md` evidence labels upgraded for the newly
exercised routes; unexercised routes remain `CODE`.

## Terminal gate results (this pass)

| Command | Exit | Result |
|---|---|---|
| `npm install --no-audit --no-fund` | 0 | lock regenerated; ~90 packages re-resolved |
| `npm run typecheck` | 0 | PASS |
| `npm run build` | 0 | PASS |
| `npm test` | 0 | 3 suites / **15 tests** (new `file-store.spec.ts`) |
| `npm run docker:db:up` | 0 | `postgres:16-alpine` `bookstore-node-test-db` @127.0.0.1:50165 |
| `npm run test:integration` | 0 | 3 suites / **16 tests** — 2 prior + 7 new checkout-flow + prior suite |
| `npm audit --omit=dev` | 0 | 0 vulnerabilities |
| `npm run db:setup` (fresh DB) | 0 | 33 tables on empty `bookstore_fresh` |
| `node dist/main.js` + HTTP smoke | 0 | live/ready/products/swagger 200 (`DB_SYNCHRONIZE=false`) |
| `dist/main.js` default handler + supertest | 0 | live/ready/products 200 |
| `npm run docker:db:down` | 0 | container removed |

## Real defects found and fixed during verification

1. `CartService.buildResponse` mapped `toUserResponse(cart.user)` but
   `getOrCreateCart` never loads the `user` relation → every cart read/write
   endpoint returned 500. Fixed by passing the already-loaded authenticated
   `user` into `buildResponse`.
2. `OrderService.mapOrders` returned `Promise[]` — `GET /api/orders` and
   `GET /api/admin/orders` serialized `[{}]` for every order. Fixed with
   `Promise.all`.

Repairs used: 2 of max-2 on the integration gate (both real production
defects, not test workarounds).

## Deploy env checklist (controller-owned secrets)

Required in production:

```
NODE_ENV=production
JWT_SECRET=<≥32-byte real secret>          # boot fails without it
CORS_ORIGINS=https://<frontend-origin>     # explicit origins only
DATABASE_URL=postgresql://<user>:<pw>@<pooler-host>:6543/postgres?sslmode=require
DB_SYNCHRONIZE=false                       # or omit — prod default is false
DB_POOL_MAX=5                              # optional; keep small on pooler
STORAGE_DRIVER=supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only>
SUPABASE_STORAGE_BUCKET=uploads            # public bucket for assets
APP_BASE_URL=https://<public-api-origin>   # used for local-driver URLs
```

First boot on a NEW database: `npm ci && npm run db:setup` (once), optional
`APP_DEMO_*` + `npm run seed` for demo data. No `vercel.json` needed —
zero-config Nest detection finds `src/main.ts` when the project root is
`backend-node/`.

## Limitations / NOT_RUN

- Real Vercel deployment, real Supabase Storage round-trip, and real
  Supabase Postgres connection: NOT_RUN here (credentials/provisioning are
  controller-owned). Verified equivalents: compiled-config URL parse,
  function-handler smoke, production-shape `dist/` boot.
- MySQL (`DB_TYPE=mysql`): config path exists, still NOT_RUN.
- `GET /health` (aggregate), multiple-upload/avatar endpoints, cron,
  paid-tier Vercel features: not exercised.
- Dev-only audit residual: 9 low (`deepmerge` via jest) — devDependencies
  only, documented, not hidden.

## Controller integration receipts (2026-10-29)

The controller reran the complete Node unit suite (21 tests), the real PostgreSQL HTTP integration suite (16 tests), typecheck/build, and production audit (0 vulnerabilities). A subsequent storage error redaction regression passes; the provider response body is no longer returned to clients, and storage requests have bounded timeouts.

Supabase pooler TLS requires the official provider CA. Set `DB_SSL_CA` to its PEM contents; verification remains enabled. `DB_POOL_MAX=1` is used for this hosted demo. The controller observed a successful certificate-verified database connection and 33 application tables.

`db:setup` now requires `DB_SETUP_CONFIRM_EMPTY=create-new-empty-schema`, connects with automatic synchronization disabled, checks that the application schema is empty, and only then creates the schema. It refuses to modify existing tables. The dedicated Supabase project was initialized once, its 33 application tables had RLS enabled and anon/authenticated direct grants revoked, and the existing-database refusal was observed live. Server PostgreSQL access remains available to the API.

A deterministic demo catalog was inserted in the newly created isolated project using separately generated private account passwords. Runtime seeding remains disabled. No SMTP, payment or AI delivery success is inferred from those fixtures. Vercel and real browser acceptance remain separate release gates.

## Single-connection checkout regression

The first hosted checkout smoke found an HTTP 500 with the deliberately bounded one-connection pool. Pricing was queried through the default repository while the order transaction held that sole connection. The controller reproduced the old failure, then bound pricing and response mapping to the transaction EntityManager. All 16 PostgreSQL integration tests now pass with DB_POOL_MAX=1, including checkout, rollback and concurrent last-unit purchase. This is the hosted-runtime regression; the earlier larger-pool tests alone did not establish it.
