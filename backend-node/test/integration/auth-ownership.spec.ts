/**
 * End-to-end auth + ownership negatives against the full Nest app on real
 * Postgres (schema synchronized by TypeORM on boot).
 *
 * Covers: unauthenticated access rejected, bad-login rejected, JWT-protected
 * endpoints accept valid tokens, cross-user order reads rejected, and
 * authorization-boundary responses for admin-only routes.
 */
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { Order } from '../../src/entities/order.entity';
import { OrderStatus, PaymentStatus, Role } from '../../src/entities/enums';
import { UserRole } from '../../src/entities/user-role.entity';
import { User } from '../../src/entities/user.entity';

describe('auth & ownership e2e (real Postgres)', () => {
  let app: INestApplication;
  let orders: Repository<Order>;
  let users: Repository<User>;
  let userRoles: Repository<UserRole>;

  const userA = {
    email: `a-${Date.now()}@test.dev`,
    password: 'password-aaa',
    firstName: 'User',
    lastName: 'A',
  };
  const userB = {
    email: `b-${Date.now()}@test.dev`,
    password: 'password-bbb',
    firstName: 'User',
    lastName: 'B',
  };
  let tokenA = '';
  let tokenB = '';

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

    orders = moduleRef.get(getRepositoryToken(Order));
    users = moduleRef.get(getRepositoryToken(User));
    userRoles = moduleRef.get(getRepositoryToken(UserRole));
  }, 120000);

  afterAll(async () => {
    await app?.close();
  });

  it('rejects unauthenticated access to protected routes', async () => {
    await request(app.getHttpServer()).get('/api/orders').expect(401);
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('serves public routes without a token', async () => {
    await request(app.getHttpServer()).get('/api/products').expect(200);
    await request(app.getHttpServer()).get('/api/health/live').expect(200);
  });

  it('rejects login with a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userA)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userA.email, password: 'not-the-password' })
      .expect(401);
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('registers, logs in, and rejects another user reading the order', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send(userB).expect(201);

    const loginA = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userA.email, password: userA.password })
      .expect(200);
    tokenA = loginA.body.accessToken;
    expect(tokenA).toBeTruthy();

    const loginB = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userB.email, password: userB.password })
      .expect(200);
    tokenB = loginB.body.accessToken;

    // Seed an order that belongs to user A directly through the repository.
    const ownerA = await users.findOneByOrFail({ email: userA.email });
    const order = await orders.save(
      orders.create({
        orderNumber: `ORD-E2E-${Date.now()}`,
        user: ownerA,
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        shippingAddress: '1 Test St',
        shippingPhone: '0900000000',
        shippingReceiverName: 'User A',
        subtotal: 100,
        shippingFee: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 100,
      }),
    );

    // Owner can read it.
    await request(app.getHttpServer())
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // Other user is rejected on the ownership boundary.
    const denied = await request(app.getHttpServer())
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect([400, 403]).toContain(denied.status);
  });

  it('rejects customer role on admin routes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${tokenB}`);
    expect([401, 403]).toContain(res.status);
  });

  it('accepts admin role on admin routes', async () => {
    const adminUser = await users.findOneByOrFail({ email: userA.email });
    await userRoles.save(userRoles.create({ user: adminUser, role: Role.ADMIN }));

    await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
  });

  it('rejects a forged/invalid bearer token', async () => {
    await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', 'Bearer not.a.real.jwt')
      .expect(401);
  });
});
