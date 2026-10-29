# bookstore-backend-node

Node.js (NestJS 11 + TypeORM 0.3 + TypeScript) port of the Spring Boot
BookStore backend (`../backend`). Same `/api` prefix, routes, response
wrappers (`ApiResponse`, `PageResponse`, Spring `Page`), and business rules.

## Quick start

```bash
npm install
cp .env.example .env        # set DB_* and JWT_SECRET
npm run docker:db:up        # disposable Postgres (bookstore-node-test-db)
npm run seed                # deterministic demo data
npm run start:dev           # or: npm run build && npm start
```

API: `http://localhost:8080/api` · Swagger: `/api/swagger-ui.html` or
`/api/docs` · Health: `/api/health/live`, `/api/health/ready`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` / `npm start` | compile / run `dist/main.js` |
| `npm run start:dev` | watch mode |
| `npm test` | unit specs (jest) |
| `npm run docker:db:up` / `:down` | disposable Postgres container |
| `npm run test:integration` | e2e specs vs the test DB |
| `npm run db:setup` | one-shot schema setup for a NEW database |
| `npm run seed` | deterministic, idempotent demo data |

## Notes

- Postgres is the verified target; `DB_TYPE=mysql` is configurable but
  unverified.
- VNPay/Grok/SMTP integrations return honest "unconfigured/disabled"
  responses unless env vars are set — they never fake success.
- Demo passwords come from `APP_DEMO_*_PASSWORD` env vars; dev fallbacks only
  outside production.
- See `docs/api-parity.md` for the Java→Node endpoint map,
  `docs/implementation-report.md` for verification evidence, and
  `docs/hosting-readiness.md` for Vercel/Supabase hosting configuration.
