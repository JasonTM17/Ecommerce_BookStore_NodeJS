# Portfolio Assets

This folder documents how BookStore portfolio visuals are produced and used.

## Current Node.js production showcase

The root [English README](../../README.md) and [Vietnamese README](../../README_VN.md) use the `node-production/` assets captured on **30 October 2026** from https://bookstore-node-web.vercel.app/. These assets replace the old Spring-era previews in the entry READMEs. The `previews/` files below remain historical assets.

| Asset | Source and scope |
| --- | --- |
| `home-desktop.jpg` | Live home page, 1440 × 1000 viewport |
| `catalog-desktop.jpg` | `/products`, live 100-product catalog |
| `search-desktop.jpg` | Catalog search for Clean Code, two matches |
| `book-detail-desktop.jpg` | `/products/46`, Clean Code |
| `cart-desktop.jpg` | Authenticated synthetic customer cart |
| `checkout-desktop.jpg` | COD checkout, synthetic address only |
| `order-success-desktop.jpg` | Successful creation of the synthetic order |
| `orders-desktop.jpg` | Actual persisted order history |
| `flash-sale-desktop.jpg` | Live `/flash-sale` interface |
| `admin-dashboard-desktop.jpg` | Authenticated synthetic admin dashboard |
| `catalog-mobile.jpg` | `/products`, 390 × 844 viewport |
| `book-detail-mobile.jpg` | `/products/56`, 390 × 844 viewport |
| `shopping-walkthrough.gif` | Eight captured desktop keyframes, 14.5 seconds, edited pacing |

The browser screenshot API produces JPEGs; delivered image dimensions can exclude the browser's scrollbar. No credentials or developer tools were captured. Data, reviews, sales counts, order activity and illustrative covers belong to a portfolio fixture; they are not evidence of commercial sales. See the [production check](../production-check.md) for verified runtime scope and known limits.

To update: open the production demo, verify each route and capture the named views using an authenticated synthetic account where needed. Do not capture a password form or publish browser storage, headers or tokens. Retain the same source dimensions for desktop frames. Then encode the walkthrough from the saved frames:

```sh
python scripts/build-showcase-media.py
```

The encoder requires Pillow, uses only local JPEG frames, adds explanatory captions and validates all eight GIF frames. It does not browse, authenticate or create orders. Review the resulting images and animation before committing. Screenshots are checked in so GitHub renders the README without runtime setup or expiring external image links.

## Asset Strategy

- `previews/`: lightweight images tracked in Git and used by README files.
- `screenshots/`: full-size generated screenshots ignored by Git to keep the repository lean.

The full screenshot set is useful for local review, case-study exports, and manual QA. The tracked preview set is optimized for GitHub rendering.

## Regenerate Full Screenshots

Start a production-like frontend first:

```bash
cd frontend
npm run start:local
```

Then capture the portfolio set:

```bash
cd frontend
BASE_URL=http://localhost:3001 npm run portfolio:screenshots
```

Expected full screenshot folders:

- `docs/portfolio/screenshots/desktop`
- `docs/portfolio/screenshots/mobile`

## Update README Previews

The README previews should be regenerated from recent full screenshots after meaningful UI changes. Keep them small enough for GitHub review.

Current tracked previews:

- `previews/home.webp`
- `previews/flash-sale.webp`
- `previews/chatbot-mobile.webp`
- `previews/admin-dashboard.webp`

## Portfolio Review Checklist

- Home page communicates the BookStore product in the first viewport.
- Flash sale page uses the final palette and no broken placeholder covers.
- Chatbot is visible, opens cleanly, and does not create mobile overflow.
- Admin dashboard looks like a usable operations surface, not a rough internal tool.
- Screenshots are refreshed after major UI changes.
