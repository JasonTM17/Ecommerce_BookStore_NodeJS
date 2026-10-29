# BookStore — Node.js Full Stack

A NestJS/TypeScript conversion of the BookStore commerce backend, paired with the existing Next.js storefront and admin interface. This fork retains the genuine upstream Git history; its Node.js work uses actual implementation dates.

The Spring Boot source remains in `backend/` as a reference. The Node.js API lives in `backend-node/`. Historical Spring/Render screenshots, workflows and deployment reports are upstream evidence; they do not establish a working Node.js deployment.

## Stack and scope

| Component | Implementation |
| --- | --- |
| API | Node.js 24, NestJS 11, TypeScript, TypeORM |
| Web | Next.js 16, React 19, Tailwind CSS, TanStack Query, Zustand |
| Persistence | PostgreSQL; dedicated Supabase database and image storage for hosting |
| Authentication | JWT access/refresh flows, bcrypt password hashing, role and ownership checks |
| Commerce | Catalog, cart, server-side pricing, checkout, inventory, orders, coupons and flash sales |
| Verification | Jest, PostgreSQL integration tests, Vitest, Playwright, dependency audit |
| Delivery | Isolated Docker Compose, Node CI, Vercel preparation |

The [route inventory](backend-node/docs/api-parity.md) distinguishes HTTP-tested behavior, unit tests and source-only implementation. A registered handler is not automatically proof of runtime parity. The [migration notes](docs/node-migration.md) describe origin, API compatibility and verification boundaries.

## Local development

Copy `.env.node.example` to `.env.node` and replace both example values with generated local secrets. Do not commit the resulting file.

```sh
docker compose --env-file .env.node -f docker-compose.node.yml up --build
```

The isolated stack exposes the storefront on port 3008 and the Node API on port 8088. Database synchronization is enabled only for this disposable local stack. Hosted runtime must use explicit schema setup/migrations and keep synchronization disabled.

For separate processes, use the commands and environment reference in [backend-node/README.md](backend-node/README.md). The storefront proxy requires an explicit Node API target outside the local default; it does not silently call the original Spring service.

## Quality and hosting evidence

Controller-observed frontend checks on 2026-10-28: lint, production build and 151 unit tests passed. Backend conversion, hosted runtime, persistent database/storage and representative commerce journeys have separate gates. Their live acceptance is still pending; no hosted Node service is asserted by this README yet.

SMTP, payment and AI integrations require their own provider credentials and live checks. Disabled or unconfigured providers must report their availability accurately. PostgreSQL is the observed integration target; MySQL compatibility requires separate execution evidence.

## Source and license

Derived from [JasonTM17/Ecommerce_BookStore](https://github.com/JasonTM17/Ecommerce_BookStore) at `ba500398213fb977540a23a62b8f4e511585a8f6`. Original implementation and documentation remain recoverable through the preserved upstream history. See [LICENSE](LICENSE).

## Expanded demo catalog

Run `node backend-node/scripts/seed-catalog.cjs` after installing backend and frontend dependencies, with the dedicated Supabase database/Storage environment and `APP_CATALOG_SEED_CONFIRM=ADD_DEMO_CATALOG`. It adds50curated book records across6categories and creates original illustrative PNG covers using the frontend Sharp dependency. Prices, stock, offers and covers are demo fixtures; no commercial edition, publisher or ISBN is fabricated. Names/authors identify the referenced works. Existing products, stock, orders and accounts are preserved. Repeated runs skip matching title/author pairs under a transaction advisory lock. No schema synchronization or user seed is run.

Current hosted fixture has55active books; catalog/search through the Vercel proxy was verified. New covers are in the dedicated Supabase public bucket under `demo-catalog/v1/`. Store server credentials only in a private environment, never in source. Font availability may affect illustrative cover rendering across operating systems.
