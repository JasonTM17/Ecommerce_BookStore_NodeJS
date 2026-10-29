/**
 * Deterministic stock-concurrency regression.
 *
 * The checkout path guards stock with an atomic conditional decrement
 * (`UPDATE products SET stock = stock - n WHERE stock >= n`). This spec runs
 * three parallel transactions against one product with stock=5 requesting 2
 * each: exactly two must commit, the third must fail, and final stock must be
 * exactly 1 — never negative, never oversold — regardless of interleaving.
 */
import { DataSource } from 'typeorm';
import { loadConfig } from '../../src/config/configuration';
import { buildDataSourceOptions } from '../../src/database/typeorm.config';
import { BadRequestException } from '../../src/common/exceptions';
import { Brand } from '../../src/entities/brand.entity';
import { Category } from '../../src/entities/category.entity';
import { Product } from '../../src/entities/product.entity';
import { OrderService } from '../../src/modules/commerce/order.service';

describe('stock concurrency regression (real Postgres)', () => {
  let dataSource: DataSource;
  let orderService: OrderService;

  beforeAll(async () => {
    dataSource = new DataSource(buildDataSourceOptions(loadConfig()));
    await dataSource.initialize();
    // decrementStock only needs the EntityManager; other deps are unused here.
    orderService = new OrderService(dataSource, {} as any, {} as any);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  async function seedProduct(stock: number): Promise<Product> {
    const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const category = await dataSource.getRepository(Category).save(
      { name: `cat-${suffix}`, isActive: true },
    );
    const brand = await dataSource.getRepository(Brand).save(
      { name: `brand-${suffix}`, isActive: true },
    );
    return dataSource.getRepository(Product).save({
      isbn: suffix.slice(0, 20),
      name: 'Concurrency probe',
      price: 100000,
      stockQuantity: stock,
      isActive: true,
      category,
      brand,
    });
  }

  it('never oversells under parallel conditional decrements', async () => {
    const product = await seedProduct(5);

    const attempt = () =>
      dataSource.transaction(async (em) => {
        const locked = await em
          .createQueryBuilder(Product, 'p')
          .setLock('pessimistic_write')
          .where('p.id = :id', { id: product.id })
          .getOneOrFail();
        await orderService.decrementStock(em, locked, 2);
      });

    const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded).toBe(2);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);

    const reloaded = await dataSource.getRepository(Product).findOneByOrFail({ id: product.id });
    expect(reloaded.stockQuantity).toBe(1);
    expect(reloaded.stockQuantity).toBeGreaterThanOrEqual(0);
  });

  it('rejects a decrement exceeding remaining stock', async () => {
    const product = await seedProduct(1);
    await expect(
      dataSource.transaction(async (em) => {
        const locked = await em.findOneOrFail(Product, { where: { id: product.id } });
        await orderService.decrementStock(em, locked, 3);
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const reloaded = await dataSource.getRepository(Product).findOneByOrFail({ id: product.id });
    expect(reloaded.stockQuantity).toBe(1);
  });
});
