/**
 * Real-HTTP persisted customer-flow regression against the full Nest app on
 * real Postgres (schema synchronized by TypeORM on boot).
 *
 * Covers: register/login, cart, full checkout with server-calculated totals
 * and flash-sale pricing, ownership denial, transactional rollback on
 * insufficient stock, concurrent checkout on the last unit, refresh-token
 * rotation/replay negatives, and upload auth/role boundaries.
 */
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { Brand } from '../../src/entities/brand.entity';
import { Category } from '../../src/entities/category.entity';
import { FlashSale } from '../../src/entities/flash-sale.entity';
import { Order } from '../../src/entities/order.entity';
import { OrderItem } from '../../src/entities/order-item.entity';
import { Product } from '../../src/entities/product.entity';
import { Role } from '../../src/entities/enums';
import { UserRole } from '../../src/entities/user-role.entity';
import { User } from '../../src/entities/user.entity';

describe('customer checkout flow e2e (real Postgres)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let products: Repository<Product>;
  let orders: Repository<Order>;
  let orderItems: Repository<OrderItem>;
  let flashSales: Repository<FlashSale>;
  let users: Repository<User>;
  let userRoles: Repository<UserRole>;
  let counter = 0;

  const suffix = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

  async function registerUser(tag: string): Promise<{ token: string; email: string }> {
    const email = `flow-${tag}-${suffix()}@test.dev`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'password-flow',
        firstName: 'Flow',
        lastName: tag,
      })
      .expect(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    return { token: res.body.accessToken, email };
  }

  async function seedProduct(stock: number, price = 60000): Promise<Product> {
    const s = suffix();
    const category = await dataSource.getRepository(Category).save({
      name: `flow-cat-${s}`,
      isActive: true,
    });
    const brand = await dataSource.getRepository(Brand).save({
      name: `flow-brand-${s}`,
      isActive: true,
    });
    return products.save({
      isbn: s.slice(0, 20),
      name: `Flow book ${s}`,
      price,
      stockQuantity: stock,
      isActive: true,
      category,
      brand,
    });
  }

  function orderBody(productId: number, quantity: number) {
    return {
      items: [{ productId, quantity }],
      shippingAddress: '1 Test St',
      shippingPhone: '0900000000',
      shippingReceiverName: 'Flow Tester',
    };
  }

  const auth = (token: string) => ['Authorization', `Bearer ${token}`] as const;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors) => {
          const messages: Record<string, string> = {};
          for (const err of errors) {
            if (err.constraints) messages[err.property] = Object.values(err.constraints)[0];
          }
          return new BadRequestException({ message: 'Validation failed', errors: messages });
        },
      }),
    );
    await app.init();

    dataSource = moduleRef.get(DataSource);
    products = moduleRef.get(getRepositoryToken(Product));
    orders = moduleRef.get(getRepositoryToken(Order));
    orderItems = dataSource.getRepository(OrderItem);
    flashSales = moduleRef.get(getRepositoryToken(FlashSale));
    users = moduleRef.get(getRepositoryToken(User));
    userRoles = moduleRef.get(getRepositoryToken(UserRole));
  }, 120000);

  afterAll(async () => {
    await app?.close();
  });

  it('runs a full customer checkout with server-calculated totals', async () => {
    const { token } = await registerUser('a');
    const product = await seedProduct(10, 60000);

    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(...auth(token))
      .send({ productId: product.id, quantity: 2 })
      .expect(201);

    const cart = await request(app.getHttpServer())
      .get('/api/cart')
      .set(...auth(token))
      .expect(200);
    expect(cart.body.totalItems).toBe(2);
    expect(cart.body.subtotal).toBe(120000);

    const created = await request(app.getHttpServer())
      .post('/api/orders')
      .set(...auth(token))
      .send(orderBody(product.id, 2))
      .expect(201);

    // Server-calculated money: subtotal, flat shipping under 200k, 10% tax.
    expect(created.body.subtotal).toBe(120000);
    expect(created.body.shippingFee).toBe(25000);
    expect(created.body.taxAmount).toBe(12000);
    expect(created.body.totalAmount).toBe(157000);
    expect(created.body.orderItems[0].price).toBe(60000);
    expect(created.body.orderStatus).toBe('PENDING');

    // Stock decremented in the same transaction.
    const reloaded = await products.findOneByOrFail({ id: product.id });
    expect(reloaded.stockQuantity).toBe(8);

    // Cart is cleared on success.
    const cartAfter = await request(app.getHttpServer())
      .get('/api/cart')
      .set(...auth(token))
      .expect(200);
    expect(cartAfter.body.totalItems).toBe(0);

    // The order is visible to its owner.
    const mine = await request(app.getHttpServer())
      .get('/api/orders')
      .set(...auth(token))
      .expect(200);
    const mineIds = (mine.body.content ?? []).map((o: any) => o.id);
    expect(mineIds).toContain(created.body.id);
  });

  it('denies another user reading the order and keeps order lists isolated', async () => {
    const { token: tokenA } = await registerUser('b1');
    const { token: tokenB } = await registerUser('b2');
    const product = await seedProduct(5);

    const created = await request(app.getHttpServer())
      .post('/api/orders')
      .set(...auth(tokenA))
      .send(orderBody(product.id, 1))
      .expect(201);

    const denied = await request(app.getHttpServer())
      .get(`/api/orders/${created.body.id}`)
      .set(...auth(tokenB));
    expect([400, 403]).toContain(denied.status);

    const listB = await request(app.getHttpServer())
      .get('/api/orders')
      .set(...auth(tokenB))
      .expect(200);
    const idsB = (listB.body.content ?? []).map((o: any) => o.id);
    expect(idsB).not.toContain(created.body.id);
  });

  it('applies active flash-sale price and decrements sold_count', async () => {
    const { token } = await registerUser('c');
    const product = await seedProduct(10, 60000);
    const sale = await flashSales.save({
      product,
      originalPrice: 60000,
      salePrice: 45000,
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 3_600_000),
      stockLimit: 10,
      maxPerUser: 2,
      isActive: true,
    });

    const created = await request(app.getHttpServer())
      .post('/api/orders')
      .set(...auth(token))
      .send(orderBody(product.id, 1))
      .expect(201);

    expect(created.body.orderItems[0].price).toBe(45000);
    expect(created.body.subtotal).toBe(45000);
    expect(created.body.taxAmount).toBe(4500);
    expect(created.body.totalAmount).toBe(74500); // 45000 + 25000 shipping + 4500

    const saleAfter = await flashSales.findOneByOrFail({ id: sale.id });
    expect(saleAfter.soldCount).toBe(1);
    const productAfter = await products.findOneByOrFail({ id: product.id });
    expect(productAfter.stockQuantity).toBe(9);

    // max_per_user guard rejects beyond the limit.
    const tooMany = await request(app.getHttpServer())
      .post('/api/orders')
      .set(...auth(token))
      .send(orderBody(product.id, 3));
    expect(tooMany.status).toBe(400);
  });

  it('rolls the whole transaction back when stock is insufficient', async () => {
    const { token, email } = await registerUser('d');
    const product = await seedProduct(1);
    const user = await users.findOneByOrFail({ email });

    // Prime the cart so we can prove it survives a failed checkout.
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set(...auth(token))
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    const failed = await request(app.getHttpServer())
      .post('/api/orders')
      .set(...auth(token))
      .send(orderBody(product.id, 2));
    expect(failed.status).toBe(400);

    // No order persisted, stock untouched, cart preserved.
    const orderCount = await orders.count({ where: { user: { id: user.id } } });
    expect(orderCount).toBe(0);
    const reloaded = await products.findOneByOrFail({ id: product.id });
    expect(reloaded.stockQuantity).toBe(1);
    const cart = await request(app.getHttpServer())
      .get('/api/cart')
      .set(...auth(token))
      .expect(200);
    expect(cart.body.totalItems).toBe(1);
  });

  it('sells the last unit to exactly one of two concurrent checkouts', async () => {
    const { token: tokenA } = await registerUser('e1');
    const { token: tokenB } = await registerUser('e2');
    const product = await seedProduct(1);

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/orders')
        .set(...auth(tokenA))
        .send(orderBody(product.id, 1)),
      request(app.getHttpServer())
        .post('/api/orders')
        .set(...auth(tokenB))
        .send(orderBody(product.id, 1)),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 400]);

    const reloaded = await products.findOneByOrFail({ id: product.id });
    expect(reloaded.stockQuantity).toBe(0);
    expect(reloaded.stockQuantity).toBeGreaterThanOrEqual(0);

    // Exactly one order item row exists for the product — no double-sell.
    const itemCount = await orderItems.count({ where: { product: { id: product.id } } });
    expect(itemCount).toBe(1);
  });

  it('rotates refresh tokens and rejects replay/garbage tokens', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `flow-f-${suffix()}@test.dev`,
        password: 'password-flow',
        firstName: 'Flow',
        lastName: 'F',
      })
      .expect(201);
    const firstRefresh = registered.body.refreshToken;

    // Rotation works once and returns a new pair.
    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefresh })
      .expect(200);
    expect(rotated.body.accessToken).toBeTruthy();
    expect(rotated.body.refreshToken).toBeTruthy();

    // Replay of the rotated-out token is rejected (hash-revoked).
    const replay = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefresh });
    expect([400, 401]).toContain(replay.status);

    // Garbage is rejected, not silently minted.
    const garbage = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not-a-real-refresh-token' });
    expect([400, 401]).toContain(garbage.status);

    // The new refresh token still works.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(200);
  });

  it('enforces auth and admin role on upload endpoints', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    // Unauthenticated → 401.
    await request(app.getHttpServer())
      .post('/api/uploads/images')
      .attach('file', png, { filename: 'probe.png', contentType: 'image/png' })
      .expect(401);

    // Customer role → denied.
    const { token: customerToken } = await registerUser('g');
    const denied = await request(app.getHttpServer())
      .post('/api/uploads/images')
      .set(...auth(customerToken))
      .attach('file', png, { filename: 'probe.png', contentType: 'image/png' });
    expect([401, 403]).toContain(denied.status);

    // Admin role → real upload through the local store; URL shape preserved.
    const { token: adminToken, email: adminEmail } = await registerUser('g-admin');
    const adminUser = await users.findOneByOrFail({ email: adminEmail });
    await userRoles.save(userRoles.create({ user: adminUser, role: Role.ADMIN }));

    const uploaded = await request(app.getHttpServer())
      .post('/api/uploads/images')
      .set(...auth(adminToken))
      .attach('file', png, { filename: 'probe.png', contentType: 'image/png' })
      .expect(201);
    expect(uploaded.body.data).toMatch(/\/api\/uploads\/.+\.png$/);

    // Wrong MIME for extension is rejected.
    const badMime = await request(app.getHttpServer())
      .post('/api/uploads/images')
      .set(...auth(adminToken))
      .attach('file', Buffer.from('not-an-image'), {
        filename: 'probe.png',
        contentType: 'text/plain',
      });
    expect(badMime.status).toBe(400);

    // Delete via the API removes the stored object.
    await request(app.getHttpServer())
      .delete('/api/uploads')
      .set(...auth(adminToken))
      .query({ url: uploaded.body.data })
      .expect(200);
  });
});
