# BookStore production check

Checked **30 October 2026** against the Vercel storefront and its same-origin Node API proxy. This is a representative demo verification, not a full production certification.

## Deployment identity and repair

| Component | Observed state |
| --- | --- |
| Storefront | [bookstore-node-web.vercel.app](https://bookstore-node-web.vercel.app/) |
| Active API | [bookstore-node-api.onrender.com](https://bookstore-node-api.onrender.com/api/health/ready) |
| Data | Dedicated Supabase PostgreSQL and Storage; existing data preserved |
| Backend source | `3238c72bca272288a8f795bda314c6e1fbf8defd` |
| Render deployment | `dep-dbi5jroae00c73b9ut8g`, observed `live` at 08:49:51 UTC |
| Application CI for that source | [40995126993 — success](https://github.com/JasonTM17/Ecommerce_BookStore_NodeJS/actions/runs/40995126993) |

The initial check found Render still serving `542933c`, while newer API fixes were already committed and CI-checked. `GET /api/coupons/available` returned 401 anonymously. Deploying the existing checked commit above restored the intended public response: **200 with seven coupons**. No database reset, new schema synchronization, new credentials or paid service upgrade was required.

## Checks performed

| Scope | Observation | Result |
| --- | --- | --- |
| API and database | `/api/health/ready`: HTTP 200, service UP, database UP | PASS |
| Catalog | `/api/products?size=100`: 100 records, `totalElements: 100` | PASS |
| Search | `Clean Code`: HTTP 200; browser displays the two matching books | PASS |
| Public coupons | `/api/coupons/available`: HTTP 200, seven records after deployment | PASS |
| Customer login | Existing synthetic customer signs in through the web form | PASS |
| Cart | Clean Code added through the detail page and shown in the cart | PASS |
| COD checkout | All three web steps completed; exactly one new synthetic order created | PASS |
| Persistence | Order `7`, `ORD502746988E57CF71`, independently read through authenticated HTTP and shown in order history | PASS |
| Price consistency | Order API and browser show 202,100 VND for the checked order | PASS |
| Anonymous boundary | Reading that order without authentication: HTTP 401 | PASS |
| Role boundary | Customer requesting `/api/admin/orders`: HTTP 403 | PASS |
| Reviews | `/api/reviews/product/56`: HTTP 200 | PASS |
| Admin read journey | Existing demo administrator signs in; dashboard shows seven orders and 100 products | PASS |
| Desktop presentation | Catalog at 1440px: no horizontal overflow or detected broken loaded images | PASS |
| Mobile presentation | Catalog and book detail at 390px: no horizontal overflow or detected broken loaded images | PASS |
| Browser logs | Captured warning/error log query returned no entries at the end of the checked journey | PASS, limited to captured session |

The demo order uses a synthetic name, non-deliverable address and a note explicitly stating no fulfillment or real payment. Existing orders, users and catalog entries were preserved. The test did not send email, submit a payment to a provider or arrange a real shipment.

## Limits and follow-up work

- This pass covers the journeys above. It does not exercise every admin mutation, coupon calculation, recovery path, route or device. Consult the [route evidence inventory](../backend-node/docs/api-parity.md).
- Render Free may sleep after 15 minutes without inbound traffic. The warm HTTP requests observed here took roughly 0.5–4.1 seconds; these are individual observations, not a performance benchmark or an uptime guarantee.
- Public storefront helpers can substitute fixtures on failed, timed-out or empty API results. Early home-page cards did use fixture data in this session. Screenshots therefore accompany direct API and persisted-order checks.
- Homepage “10,000+ titles” and “10K+ favorites” are template marketing copy. They are not observed catalog size or usage. The verified catalog count here is 100.
- Book covers, prices, inventory, reviews, purchase markers and sales counts in seeded data are demo fixtures. They do not substantiate real customer purchases, reviews, revenue or publisher affiliations.
- VNPay is disabled in checkout until merchant configuration is supplied. Live VNPay transactions, SMTP delivery and AI provider responses are **NOT_RUN** in this check.
- The mobile app workspace, MySQL compatibility, load testing, cold-start recovery and all-browser/device coverage are **NOT_RUN** here.

## Visual evidence

The [tracked screenshots and GIF](portfolio/README.md) were captured from these actual browser flows on the same date. The GIF sequences eight real keyframes with edited timing and captions. It is a walkthrough rather than a continuous recording or a speed measurement. No password, token or private environment content is included.
