# API Parity — Java Spring Boot → Node.js (NestJS + TypeORM)

Reference: `backend/src/main/java/com/bookstore/controller/` (26 controller
files, extracted by `scripts/inventory-java.js`).
Implementation: `backend-node/src/modules/**` (extracted by
`scripts/inventory-node.js`). All routes are mounted under the global `/api`
prefix (`src/main.ts: app.setGlobalPrefix('api')`).

Evidence legend:
- **E2E** — exercised over HTTP against real Postgres (integration suite or
  live smoke on `node dist/main.js`).
- **UNIT** — covered by a jest unit spec.
- **CODE** — handler implemented and route registered; verified by compile +
  route inventory, not yet exercised over HTTP.

## 1. AuthController.java → `auth/auth.controller.ts`

| Java route | Node handler | Wrapper | Evidence |
|---|---|---|---|
| POST /auth/register | `AuthController.register` | bare AuthResponse | E2E (register→login), UNIT |
| POST /auth/login | `AuthController.login` | bare AuthResponse | E2E, UNIT |
| POST /auth/refresh | `AuthController.refreshToken` | bare AuthResponse | E2E (rotation + replay/garbage negatives), UNIT |
| POST /auth/logout | `AuthController.logout` | 200 empty | CODE |

## 2. PasswordResetController.java → `auth/auth.controller.ts`

| Java route | Node handler | Wrapper | Evidence |
|---|---|---|---|
| POST /auth/forgot-password | `AuthController.forgotPassword` | ApiResponse\<Void\> | CODE |
| POST /auth/reset-password | `AuthController.resetPassword` | ApiResponse\<Void\> | CODE |

## 3. UserController.java → `users/users.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| GET /users/me | `UsersController.getProfile` | E2E (401 negative) |
| PUT /users/me | `UsersController.updateProfile` | CODE |
| POST /users/change-password | `UsersController.changePassword` (200) | UNIT (service) |

## 4. AddressController.java → `users/addresses.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| GET /addresses | `AddressesController.list` | CODE |
| POST /addresses | `AddressesController.create` | CODE |
| PUT /addresses/{id} | `AddressesController.update` (ownership) | CODE |
| DELETE /addresses/{id} | `AddressesController.remove` (ownership) | CODE |

## 5. ProductController.java → `catalog/catalog.controller.ts` (@Public)

| Java route | Node handler | Evidence |
|---|---|---|
| GET /products | `CatalogController.getProducts` (Page) | E2E smoke |
| GET /products/featured | `getFeaturedProducts` (PageResponse) | CODE |
| GET /products/bestsellers | `getBestsellers` (PageResponse) | CODE |
| GET /products/new | `getNewProducts` (PageResponse) | CODE |
| GET /products/low-stock | `getLowStock` | CODE |
| GET /products/category/{id} | `getProductsByCategory` (Page) | CODE |
| GET /products/{id} | `getProduct` | E2E smoke (via list) |
| GET /products/{id}/related | `getRelated` | CODE |

## 6. CategoryController.java → `catalog/catalog.controller.ts` (@Public)

| Java route | Node handler | Evidence |
|---|---|---|
| GET /categories | `getCategories` | E2E smoke |
| GET /categories/root | `getRootCategories` | CODE |
| GET /categories/{id} | `getCategory` | CODE |
| GET /categories/{parentId}/subcategories | `getSubcategories` | CODE |

## 7. BrandController.java → `catalog/catalog.controller.ts` (@Public)

| Java route | Node handler | Evidence |
|---|---|---|
| GET /brands | `getBrands` | E2E smoke |
| GET /brands/{id} | `getBrand` | CODE |

## 8. CartController.java → `commerce/cart.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| GET /cart | `getCart` | E2E (add→read→cleared-by-checkout) |
| POST /cart/items | `addItem` | E2E |
| PUT /cart/items/{itemId} | `updateItem` (ownership) | CODE |
| DELETE /cart/items/{itemId} | `removeItem` (ownership) | CODE |
| DELETE /cart | `clearCart` | CODE |

## 9. OrderController.java → `commerce/order.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| POST /orders | `createOrder` (tx, row locks, conditional stock decrement) | E2E+UNIT+INTEGRATION (totals, flash price, rollback, concurrent checkout) |
| GET /orders | `getUserOrders` (Page) | E2E (401 negative + owned list) |
| GET /orders/{id} | `getOrderById` (owner/admin only) | E2E+UNIT ownership |

## 10. CouponController.java → `commerce/coupon.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| POST /coupons | `create` (ADMIN) | CODE |
| GET /coupons | `getAll` (ADMIN, Page) | CODE |
| GET /coupons/available | `getAvailable` | CODE |
| GET /coupons/search | `search` | CODE |
| POST /coupons/validate | `validate` | CODE |
| GET /coupons/{id} | `getById` | CODE |
| PUT /coupons/{id} | `update` (ADMIN) | CODE |
| DELETE /coupons/{id} | `remove` (ADMIN) | CODE |

## 11. FlashSaleController.java → `commerce/flash-sale.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| GET /flash-sales/active | `getActiveFlashSales` (@Public, ApiResponse) | E2E smoke |
| GET /flash-sales/upcoming | `getUpcomingFlashSales` (@Public) | E2E smoke |
| GET /flash-sales/{id} | `getFlashSale` (@Public) | CODE |
| GET /admin/flash-sales | `getAllFlashSales` (ADMIN) | CODE |
| POST /admin/flash-sales | `createFlashSale` (ADMIN) | CODE |
| PUT /admin/flash-sales/{id} | `updateFlashSale` (ADMIN) | CODE |

Frontend-required extra: `DELETE /admin/flash-sales/{id}` → `deleteFlashSale`
(ADMIN). Not in Java; added for `frontend` caller compatibility.

## 12. InventoryController.java → `commerce/inventory.controller.ts` (ADMIN)

| Java route | Node handler | Evidence |
|---|---|---|
| POST /admin/inventory/adjust | `adjust` (pessimistic lock + InventoryLog) | CODE |
| GET /admin/inventory/low-stock | `lowStock` | CODE |
| GET /admin/inventory/history/{productId} | `history` | CODE |
| GET /admin/inventory/logs | `logs` (Page) | CODE |

## 13. PaymentController.java → `commerce/payment.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| POST /payments/vnpay/create | `createVnpayPayment` — 4xx "chưa được cấu hình" when unconfigured | CODE |
| GET /payments/vnpay/return | `vnpayReturn` (@Public, HMAC verify) | CODE |
| POST /payments/vnpay/ipn | `vnpayIpn` (@Public, HMAC verify) | CODE |
| GET /payments/{orderId}/status | `getPaymentStatus` | CODE |
| POST /payments/{orderId}/refund | `refund` (ADMIN) | CODE |

## 14. ReviewController.java → `engagement/review.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| GET /reviews/product/{productId} | `getProductReviews` (@Public, Page) | CODE |
| POST /reviews | `create` (auth) | CODE |
| DELETE /reviews/{id} | `remove` (owner/admin) | CODE |

## 15. WishlistController.java → `engagement/wishlist.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| POST /wishlist/{productId} | `add` | CODE |
| GET /wishlist | `list` | CODE |
| GET /wishlist/{productId} | `check` | CODE |
| GET /wishlist/count | `count` | CODE |
| DELETE /wishlist/{productId} | `remove` | CODE |
| PATCH /wishlist/{productId}/notes | `updateNotes` | CODE |
| PATCH /wishlist/{productId}/priority | `updatePriority` | CODE |

## 16. ReadingController.java → `reading/reading.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| POST /reading/start/{productId} | `start` | CODE |
| GET /reading/progress | `getProgress` | CODE |
| PUT /reading/progress/{id} | `updateProgress` (ownership) | CODE |
| POST /reading/finish/{id} | `finish` | CODE |
| GET /reading/stats | `getStats` | CODE |

Frontend-required extras (not in Java):
- `POST /reading/progress` → upsert progress (`frontend/src/lib/reading.ts`)
- `POST /reading/progress/{id}/finish` → finish alias used by the frontend
- `GET /reading/streak`, `GET|POST /reading/challenges`

## 17. BookClubController.java → `clubs/book-club.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| POST /clubs | `createClub` | CODE |
| GET /clubs | `listClubs` (@Public, Page) | CODE |
| GET /clubs/{id} | `getClub` | CODE |
| POST /clubs/{id}/join | `join` | CODE |
| POST /clubs/{id}/leave | `leave` | CODE |
| GET /clubs/{id}/members | `members` | CODE |

Frontend-required extras: `GET|POST /clubs/{id}/discussions`,
`POST /discussions/{id}/like`.

## 18. ChatbotController.java → `chatbot/chatbot.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| POST /chatbot/message | `message` — DISABLED fallback when unconfigured | CODE |
| GET /chatbot/conversations | `conversations` | CODE |
| GET /chatbot/conversations/{id} | `conversation` (ownership) | CODE |
| DELETE /chatbot/conversations/{id} | `deleteConversation` (ownership) | CODE |
| POST /chatbot/feedback | `feedback` | CODE |
| GET /chatbot/stats | `stats` | CODE |
| GET /chatbot/health | `health` (@Public) | E2E smoke (DISABLED) |

## 19. FileController.java → `files/file.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| POST /uploads/images | `uploadImage` (bounded size/type) | E2E (401/role-denied/admin 201 + MIME negative) |
| POST /uploads/images/multiple | `uploadImages` (max count bound) | CODE |
| POST /uploads/avatar | `uploadAvatar` | CODE |
| DELETE /uploads | `deleteFile` | E2E (admin delete round-trip) |

## 20. HealthController.java → `health/health.controller.ts` (@Public)

| Java route | Node handler | Evidence |
|---|---|---|
| GET /health | `health` | CODE |
| GET /health/live | `live` | E2E smoke |
| GET /health/ready | `ready` (DB check) | E2E smoke |

## 21. AdminController.java → `admin/admin.controller.ts` (ADMIN)

| Java route | Node handler | Evidence |
|---|---|---|
| GET /admin/dashboard | `dashboard` | E2E (role allowed + role denied) |
| GET /admin/users | `listUsers` (Page) | CODE |
| GET /admin/users/search | `searchUsers` | CODE |
| PUT /admin/users/{id}/role | `updateRole` | CODE |
| PUT /admin/users/{id}/activate | `activate` | CODE |
| PUT /admin/users/{id}/deactivate | `deactivate` | CODE |

## 22–24. AdminProduct/AdminCategory/AdminBrand/AdminOrder → `admin/admin.controller.ts` (ADMIN)

| Java route | Node handler | Evidence |
|---|---|---|
| POST /admin/products | `createProduct` | CODE |
| PUT /admin/products/{id} | `updateProduct` | CODE |
| DELETE /admin/products/{id} | `deleteProduct` | CODE |
| POST /admin/categories | `createCategory` | CODE |
| PUT /admin/categories/{id} | `updateCategory` | CODE |
| DELETE /admin/categories/{id} | `deleteCategory` | CODE |
| POST /admin/brands | `createBrand` | CODE |
| PUT /admin/brands/{id} | `updateBrand` | CODE |
| DELETE /admin/brands/{id} | `deleteBrand` | CODE |
| GET /admin/orders | `listOrders` (Page) | CODE |
| GET /admin/orders/{id} | `getOrder` | CODE |
| PUT /admin/orders/{id}/status | `updateOrderStatus` | CODE |
| PUT /admin/orders/{id}/payment | `updatePaymentStatus` | CODE |

## 25. EmailTestController.java → `email/email.controller.ts`

| Java route | Node handler | Evidence |
|---|---|---|
| GET /email/health | `health` (ADMIN + config-gated) | CODE |
| POST /email/test/send | `sendTest` (ADMIN + APP_EMAIL_TEST_ENABLED + recipient allowlist) | CODE |
| POST /email/test/send-all | `sendAllTests` | CODE |
| POST /email/test/newsletter-weekly | `sendNewsletterWeekly` | CODE |

## 26. Frontend-only endpoints (no Java counterpart)

| Route | Node handler | Frontend caller |
|---|---|---|
| GET /isbn/lookup/{isbn} | `isbn/isbn.controller.ts` | `frontend/src/lib/isbn.ts` |
| GET /isbn/compare/{isbn} | `isbn/isbn.controller.ts` | `frontend/src/lib/isbn.ts` |
| POST /client-errors | `misc/client-errors.controller.ts` (@Public beacon) | `frontend/src/lib/monitoring.ts` |
| GET /clubs/{id}/discussions | `clubs` | frontend club pages |
| POST /clubs/{id}/discussions | `clubs` | frontend club pages |
| POST /discussions/{id}/like | `clubs` | frontend club pages |
| GET /reading/challenges, GET /reading/streak, POST /reading/progress, POST /reading/progress/{id}/finish | `reading` | `frontend/src/lib/reading.ts` |
| DELETE /admin/flash-sales/{id} | `flash-sale` | frontend admin page |

## Notes

- **Rentals:** `BookRental`/`RentalPricing` entities exist in Java; no Java or
  frontend controller routes were found. Entities are ported for schema parity
  only — no endpoints (matching Java).
- **Wrappers:** `ApiResponse<T>`, `PageResponse<T>`, raw DTOs, and Spring
  `Page<T>` shapes (`content/totalElements/totalPages/size/number/...`) are
  preserved per-endpoint as in Java.
- **Swagger:** `/api/swagger-ui.html` + `/api/docs` (Java: `/api/swagger-ui.html`).
