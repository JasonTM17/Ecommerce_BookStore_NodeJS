# Node.js backend conversion

This repository derives from JasonTM17/Ecommerce_BookStore at commit
`ba500398213fb977540a23a62b8f4e511585a8f6`. The original Git history is retained
without date changes. New commits record the actual implementation date.

The conversion target is a TypeScript NestJS backend in `backend-node/`, with
the existing Next.js storefront and administrative interface in `frontend/`.
The Spring Boot implementation in `backend/` remains a reference during parity
verification. Do not migrate a live database using development synchronization
or seed commands.

## API compatibility

The frontend keeps its `/api` base path. The server proxy uses
`http://127.0.0.1:8080/api` by default, or an explicitly configured
`BACKEND_HOSTPORT` / `API_PROXY_TARGET`. The Node.js fork does not silently send
requests to the original hosted Spring Boot application.

Node implementation and route-level evidence are tracked in
`backend-node/docs/api-parity.md` once authored. A UI screenshot or fallback
catalog alone does not establish backend parity. End-to-end acceptance must
observe persisted cart/order/inventory changes through the Node API.

## Verification boundaries

Use a dedicated disposable database for tests. PostgreSQL is the initial local
integration target. MySQL behavior must be tested separately before claiming
both engines are supported. SMTP, payment and AI providers need their own
configured integration evidence; missing credentials must never become fake
successful payments, email delivery or AI results.

The existing Render blueprint and Java CI describe the upstream application.
They are not evidence of a deployed Node.js service. Vercel deployment of this
fork is authorized and requires its own reviewed configuration and hosted checks.

## Current free demo (2026-10-29)

The Node API runs at https://bookstore-node-api.onrender.com/api with a dedicated
Supabase PostgreSQL database and image bucket. The Vercel storefront at
https://bookstore-node-web.vercel.app proxies `/api` to that Render API. The
previous Neon `bookstore-node-db` was deleted at the user's explicit request
after Supabase verification; it is no longer a dependency. Vercel's API deployment
remains an alternative, rather than the active storefront target.

Observed on Render: readiness/database UP, customer login, real catalog/cart,
cash checkout, persisted owner read, anonymous order denial, admin image upload,
public byte equality and object cleanup. The hosted checkout regression is also
covered by16 real PostgreSQL integration tests with a one-connection pool.
Exact backend commit542933c passed the Node GitHub CI run40799938964.
Render Free sleeps after15 minutes without inbound traffic; cold requests can
take longer. No paid capacity or artificial keepalive is configured. External
SMTP/payment/AI providers remain outside this observed demo acceptance.
