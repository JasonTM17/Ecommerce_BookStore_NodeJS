# Implementation Report — backend-node (NestJS + TypeORM)

Date: 2026-10-28. Scope: `backend-node/**` only.
Reference implementation preserved untouched at `backend/` (Spring Boot).

## Command results (all run in `backend-node/`)

| Command | Exit | Status |
|---|---|---|
| `npm install` | 0 | PASS (lockfile `package-lock.json` generated; npm audit reports 39 vulns: 11 low / 13 moderate / 15 high — transitive deps, no fix applied) |
| `npm run typecheck` (`tsc --noEmit`) | 0 | PASS |
| `npm run build` (`nest build`) | 0 | PASS |
| `npm test` (jest unit) | 0 | PASS — 2 suites, 12 tests |
| `npm run docker:db:up` | 0 | PASS — `postgres:16-alpine`, container `bookstore-node-test-db`, dynamic host port |
| `npm run test:integration` | 0 | PASS — 2 suites, 9 tests vs real Postgres |
| `npm run seed` (x2, idempotency check) | 0 | PASS — deterministic keyed upserts |
| `node dist/main.js` + HTTP smoke | 0 | PASS — see smoke table |
| `npm run docker:db:down` | 0 | PASS — container removed |

## Live smoke evidence (built `dist/`, real Postgres, PORT=8181)

| Request | Result |
|---|---|
| GET /api/health/live | 200 `{"status":"UP",...}` |
| GET /api/health/ready | 200 `{"status":"UP","database":"UP"}` |
| GET /api/products | 200 Spring-Page JSON, seeded books |
| GET /api/products?keyword=kim | 200 flash-sale effective price (`currentPrice:59000`) |
| GET /api/categories, /api/brands | 200 |
| GET /api/flash-sales/active | 200 `ApiResponse` with seeded sale |
| GET /api/flash-sales/upcoming | 200 `ApiResponse` empty list |
| POST /api/auth/login (seeded demo user) | 200 JWT accessToken + roles |
| GET /api/orders (no token) | 401 |
| GET /api/swagger-ui.html | 200 |
| GET /api/chatbot/health | 200 `status:"DISABLED"` (unconfigured → honest unavailable) |

## Capability status

| Capability | Status | Evidence |
|---|---|---|
| API surface: 26 Java controllers → Node handlers | PASS | `docs/api-parity.md`; inventory scripts confirm every Java route registered |
| Frontend-only routes (isbn, client-errors, clubs discussions, reading extras, flash-sale DELETE) | PASS | implemented; caller-matched paths |
| JWT auth: register/login/refresh-rotation/logout | PASS | unit tests (8 negatives) + E2E login |
| Password reset tokens | PASS (code) / NOT_RUN (email delivery unconfigured) | handler + hashed-token store |
| Refresh-token hashing + revocation | PASS | SHA-256 hashed storage; unit tests |
| Global auth guard + role guard + user reload | PASS | E2E 401/403/200 matrix |
| Ownership checks (orders, addresses, cart, wishlist, conversations) | PASS | E2E cross-user order denial + unit |
| Catalog list/search/filters/pagination | PASS | smoke + Page/PageResponse shapes |
| Effective pricing (product discount + flash sale) | PASS | smoke shows flash-sale price applied |
| Transactional checkout: locks, conditional stock decrement, cart clear | PASS | integration: 3 parallel checkouts, stock=5 → 2 commit, final stock=1, never negative |
| Flash-sale stock + max-per-user guards | PASS (code path in same tx) | conditional `sold_count` update |
| Order cancel restock (active products only) | PASS (code) | mirrors Java semantics |
| Coupons CRUD/validate/limits | PASS (code) | handler-level; not E2E-smoked |
| Inventory adjust + logs (pessimistic lock) | PASS (code) | row lock + InventoryLog |
| VNPay create/return/ipn/status/refund | PASS (unconfigured semantics) / NOT_RUN (real VNPay) | returns configuration error, no fake success; HMAC verify implemented |
| File uploads bounded (type/size/count) | PASS (code) | multer limits + MIME allowlist |
| Chatbot conversations/feedback/stats/health | PASS (disabled-state) / BLOCKED_CAPABILITY (live Grok) | `GROK_ENABLED=false`/no key → DISABLED, honest health |
| Email send | BLOCKED_CAPABILITY | no SMTP configured → sends skipped/logged, never faked; test endpoints config-gated + recipient allowlist |
| Admin dashboard/users/orders/products/categories/brands | PASS | E2E role allow+deny on dashboard |
| Reviews, wishlist, reading, book clubs | PASS (code) | handlers + ownership/membership checks; not all HTTP-smoked |
| Health live/ready + Swagger | PASS | smoke 200s |
| PostgreSQL integration | PASS | all of the above on `postgres:16-alpine` |
| MySQL support | NOT_RUN | config path exists (`DB_TYPE=mysql`), no MySQL executed — do not claim parity |
| Rate limiting + security headers + CORS allowlist | PASS | middleware wired; disabled under test env |
| Deterministic demo seed | PASS | idempotent double-run verified |
| Fail-closed production config | PASS | prod asserts JWT_SECRET strength + explicit CORS |
| npm audit hygiene | FAIL/KNOWN | 39 transitive vulnerabilities reported by npm (no runtime pinning applied; flagged for controller review) |
| Mobile/FE manual verification | NOT_RUN | out of owned scope |

## Deterministic regression coverage

- `test/integration/stock-concurrency.spec.ts` — parallel conditional
  decrements via the real `OrderService.decrementStock` on real Postgres:
  exactly 2 of 3 commit, loser gets `BadRequestException`, final stock ≥ 0.
- `test/integration/auth-ownership.spec.ts` — full-app e2e: 401 unauthenticated,
  public 200, wrong-password 401, cross-user order denial, admin role
  allow/deny, forged-JWT 401.
- `src/modules/auth/auth.service.spec.ts` — 8 auth negatives.
- `src/modules/commerce/order.service.spec.ts` — ownership unit tests.

## Notable fixes during verification

- 47 nullable union-typed entity columns lacked explicit SQL types → TypeORM
  emitted `Object` (runtime failure). Codemod added `varchar/text/int/timestamp/
  boolean`; caught by integration run, not by tsc.
- `User.lastName`/`full_name` mapping preserved per Java.
- Java status codes corrected: logout & change-password → 200.
- Order `*DisplayName` fields use raw enum `.name()` (Java parity), not labels.

## Files of note

- `src/main.ts`, `src/app.module.ts`, `src/config/configuration.ts`,
  `src/database/typeorm.config.ts`
- `src/common/` — guards, decorators, ApiResponse/PageResponse, exception
  filter, mappers, rate-limit + security-headers middleware
- `src/entities/` — 40 entities, `ALL_ENTITIES` registry
- `src/modules/` — auth, users, catalog, commerce (cart/orders/coupons/
  flash-sales/inventory/payments), engagement (reviews/wishlist), reading,
  clubs, chatbot, files, admin, health, isbn, email, misc
- `src/seed.ts`, `.env.example`, `scripts/test-db.js`,
  `scripts/inventory-{java,node}.js`, `test/`, `docs/`
