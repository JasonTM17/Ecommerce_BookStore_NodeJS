import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { config } from './config/configuration';
import { buildDataSourceOptions } from './database/typeorm.config';
import { Brand } from './entities/brand.entity';
import { Cart } from './entities/cart.entity';
import { Category } from './entities/category.entity';
import { Coupon } from './entities/coupon.entity';
import { CouponType, Role } from './entities/enums';
import { FlashSale } from './entities/flash-sale.entity';
import { Product } from './entities/product.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';

/**
 * Deterministic demo seed for disposable development/test databases.
 *
 * - Idempotent: keyed lookups make a second run a no-op.
 * - Demo passwords come from APP_DEMO_* env vars; development falls back to
 *   fixed documented demo passwords. In production the seed refuses to run
 *   without explicit APP_DEMO_* passwords to avoid shipping defaults.
 */
async function main() {
  if (config.isProduction && !config.seed.enabled) {
    throw new Error('Demo seed is disabled in production (set APP_DEMO_SEED_ENABLED=true to force)');
  }

  const defaultPassword = (envValue: string, devFallback: string) =>
    config.isProduction ? envValue : envValue || devFallback;

  const adminPassword = defaultPassword(config.seed.adminPassword, 'Admin@123');
  const managerPassword = defaultPassword(config.seed.managerPassword, 'Manager@123');
  const customerPassword = defaultPassword(config.seed.customerPassword, 'Customer@123');
  if (config.isProduction && (!adminPassword || !managerPassword || !customerPassword)) {
    throw new Error('APP_DEMO_*_PASSWORD must be set for production seeding');
  }

  const dataSource = new DataSource(buildDataSourceOptions(config));
  await dataSource.initialize();
  console.log(`[seed] connected to ${config.db.type}://${config.db.host}:${config.db.port}/${config.db.name}`);

  try {
    const users = dataSource.getRepository(User);
    const roles = dataSource.getRepository(UserRole);
    const carts = dataSource.getRepository(Cart);
    const categories = dataSource.getRepository(Category);
    const brands = dataSource.getRepository(Brand);
    const products = dataSource.getRepository(Product);
    const coupons = dataSource.getRepository(Coupon);
    const flashSales = dataSource.getRepository(FlashSale);

    const ensureUser = async (
      email: string, password: string, fullName: string, userRoles: Role[],
    ) => {
      let user = await users.findOne({ where: { email } });
      if (!user) {
        user = await users.save(users.create({
          email,
          passwordHash: await bcrypt.hash(password, 12),
          firstName: fullName,
          isActive: true,
          isEmailVerified: true,
        }));
      }
      for (const role of userRoles) {
        const has = await roles.findOne({ where: { user: { id: user.id }, role } });
        if (!has) await roles.save(roles.create({ user, role }));
      }
      if (!(await carts.findOne({ where: { user: { id: user.id } } }))) {
        await carts.save(carts.create({ user }));
      }
      return user;
    };

    await ensureUser('admin@bookstore.dev', adminPassword, 'Quản trị viên', [Role.ADMIN]);
    await ensureUser('manager@bookstore.dev', managerPassword, 'Quản lý cửa hàng', [Role.MANAGER]);
    await ensureUser('customer@bookstore.dev', customerPassword, 'Khách hàng mẫu', [Role.CUSTOMER]);

    const ensureCategory = async (name: string, sortOrder: number, parent: Category | null = null) => {
      let category = await categories.findOne({ where: { name } });
      if (!category) {
        category = await categories.save(categories.create({
          name, description: `Danh mục ${name}`, sortOrder, parent, isActive: true,
        }));
      }
      return category;
    };

    const vanHoc = await ensureCategory('Văn học', 1);
    const kinhTe = await ensureCategory('Kinh tế', 2);
    const thieuNhi = await ensureCategory('Thiếu nhi', 3);
    await ensureCategory('Tiểu thuyết', 1, vanHoc);
    await ensureCategory('Kỹ năng sống', 4);

    const ensureBrand = async (name: string) => {
      let brand = await brands.findOne({ where: { name } });
      if (!brand) {
        brand = await brands.save(brands.create({ name, isActive: true }));
      }
      return brand;
    };

    const nhaNam = await ensureBrand('NXB Trẻ');
    const kimDong = await ensureBrand('Kim Đồng');
    const alpha = await ensureBrand('Alpha Books');

    const ensureProduct = async (
      isbn: string, data: Partial<Product> & { category: Category; brand: Brand },
    ) => {
      let product = await products.findOne({ where: { isbn } });
      if (!product) {
        product = products.create({
          isbn,
          language: 'Vietnamese',
          isActive: true,
          avgRating: 0,
          reviewCount: 0,
          soldCount: 0,
          viewCount: 0,
          stockQuantity: 100,
          discountPercent: 0,
          sortOrder: 0,
          ...data,
        });
        product.calculateDiscountPrice();
        await products.save(product);
      }
      return product;
    };

    const books = [
      await ensureProduct('9786040000001', {
        name: 'Nhà giả kim', author: 'Paulo Coelho', publisher: 'NXB Văn học',
        price: 79000, discountPercent: 10, stockQuantity: 50, pageCount: 208,
        publishedYear: 2020, category: vanHoc, brand: nhaNam,
        isFeatured: true, isBestseller: true,
        shortDescription: 'Tiểu thuyết triết lý nổi tiếng của Paulo Coelho',
      }),
      await ensureProduct('9786040000002', {
        name: 'Đắc nhân tâm', author: 'Dale Carnegie', publisher: 'NXB Tổng hợp',
        price: 86000, discountPercent: 15, stockQuantity: 80, pageCount: 320,
        publishedYear: 2019, category: kinhTe, brand: alpha,
        isBestseller: true,
        shortDescription: 'Cẩm nang giao tiếp kinh điển',
      }),
      await ensureProduct('9786040000003', {
        name: 'Dế mèn phiêu lưu ký', author: 'Tô Hoài', publisher: 'Kim Đồng',
        price: 55000, stockQuantity: 120, pageCount: 180,
        publishedYear: 2018, category: thieuNhi, brand: kimDong,
        isNew: true,
        shortDescription: 'Tác phẩm thiếu nhi kinh điển Việt Nam',
      }),
      await ensureProduct('9786040000004', {
        name: 'Tư duy nhanh và chậm', author: 'Daniel Kahneman', publisher: 'NXB Thế giới',
        price: 189000, discountPercent: 20, stockQuantity: 30, pageCount: 612,
        publishedYear: 2021, category: kinhTe, brand: alpha,
        isFeatured: true,
        shortDescription: 'Tác phẩm kinh điển về tâm lý ra quyết định',
      }),
      await ensureProduct('9786040000005', {
        name: 'Số đỏ', author: 'Vũ Trọng Phụng', publisher: 'NXB Văn học',
        price: 69000, stockQuantity: 5, pageCount: 250,
        publishedYear: 2020, category: vanHoc, brand: nhaNam,
        shortDescription: 'Tiểu thuyết phóng sự đậm chất Việt',
      }),
    ];

    if (!(await coupons.findOne({ where: { code: 'WELCOME10' } }))) {
      await coupons.save(coupons.create({
        code: 'WELCOME10',
        description: 'Giảm 10% cho đơn hàng đầu tiên',
        type: CouponType.PERCENTAGE,
        discountValue: 10,
        minOrderAmount: 100000,
        maxDiscount: 50000,
        usageLimit: 1000,
        perUserLimit: 1,
        isActive: true,
        isPublic: true,
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      }));
    }

    if (!(await flashSales.findOne({ where: { product: { id: books[0].id } } }))) {
      await flashSales.save(flashSales.create({
        product: books[0],
        originalPrice: books[0].price,
        salePrice: 59000,
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        stockLimit: 20,
        maxPerUser: 2,
        isActive: true,
      }));
    }

    console.log('[seed] demo data ready: 3 users, 5 categories, 3 brands, 5 products, 1 coupon, 1 flash sale');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('[seed] failed:', error?.message ?? error);
  process.exit(1);
});
