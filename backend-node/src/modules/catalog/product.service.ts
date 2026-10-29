import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { toPageResponse, PageResponse } from '../../common/dto/page-response.dto';
import {
  ConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { Brand } from '../../entities/brand.entity';
import { Category } from '../../entities/category.entity';
import { ProductImage } from '../../entities/product-image.entity';
import { Product } from '../../entities/product.entity';
import { Review } from '../../entities/review.entity';
import {
  toProductResponse,
  ProductResponseShape,
} from './catalog.mappers';
import { ProductQuery, ProductRequest } from './dto/catalog.dto';
import { EffectivePricingService } from './effective-pricing.service';

const SORTABLE_FIELDS = new Set([
  'createdAt',
  'price',
  'name',
  'soldCount',
  'viewCount',
  'avgRating',
  'sortOrder',
]);

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductImage) private readonly images: Repository<ProductImage>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Brand) private readonly brands: Repository<Brand>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    private readonly pricing: EffectivePricingService,
  ) {}

  async getProducts(query: ProductQuery): Promise<PageResponse<ProductResponseShape>> {
    const page = query.page ?? 0;
    const size = query.size ?? 12;
    const qb = this.products.createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('category.parent', 'parent')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.images', 'images')
      .where('p.isActive = :active', { active: true });

    if (query.keyword?.trim()) {
      const kw = `%${query.keyword.trim().toLowerCase()}%`;
      qb.andWhere(new Brackets((q) =>
        q.where('LOWER(p.name) LIKE :kw', { kw })
          .orWhere('LOWER(p.author) LIKE :kw', { kw })
          .orWhere('LOWER(p.description) LIKE :kw', { kw }),
      ));
    }
    if (query.categoryId != null) {
      const ids = await this.resolveCategoryIds(query.categoryId);
      qb.andWhere('category.id IN (:...catIds)', { catIds: ids });
    }
    if (query.brandId != null) {
      qb.andWhere('brand.id = :brandId', { brandId: query.brandId });
    }
    if (query.minPrice != null) qb.andWhere('p.price >= :minPrice', { minPrice: query.minPrice });
    if (query.maxPrice != null) qb.andWhere('p.price <= :maxPrice', { maxPrice: query.maxPrice });
    if (query.inStock) qb.andWhere('p.stockQuantity > 0');

    this.applySort(qb, query.sortBy, query.direction);
    qb.skip(page * size).take(size);

    const [items, total] = await qb.getManyAndCount();
    const content = await this.mapList(items);
    return toPageResponse(content, total, page, size);
  }

  async getFeatured(): Promise<ProductResponseShape[]> {
    const items = await this.products.find({
      where: { isActive: true, isFeatured: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
    return this.mapList(items);
  }

  async getBestsellers(): Promise<ProductResponseShape[]> {
    const items = await this.products.find({
      where: { isActive: true, isBestseller: true },
      order: { soldCount: 'DESC' },
    });
    return this.mapList(items);
  }

  async getNew(): Promise<ProductResponseShape[]> {
    const items = await this.products.find({
      where: { isActive: true, isNew: true },
      order: { createdAt: 'DESC' },
    });
    return this.mapList(items);
  }

  async getByCategory(categoryId: number, page: number, size: number): Promise<PageResponse<ProductResponseShape>> {
    const ids = await this.resolveCategoryIds(categoryId);
    const [items, total] = await this.products.findAndCount({
      where: { isActive: true, category: { id: In(ids) } },
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return toPageResponse(await this.mapList(items), total, page, size);
  }

  async getById(id: number): Promise<ProductResponseShape> {
    const product = await this.products.findOne({ where: { id } });
    if (!product || !product.isActive) {
      throw new ResourceNotFoundException('Product', 'id', id);
    }
    const response = await this.mapOne(product);
    await this.products.increment({ id }, 'viewCount', 1);
    return response;
  }

  /** Same lookup used by admin/detail flows where inactive products are allowed. */
  async getByIdAnyState(id: number): Promise<ProductResponseShape> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new ResourceNotFoundException('Product', 'id', id);
    return this.mapOne(product);
  }

  async getRelated(productId: number, categoryId?: number): Promise<ProductResponseShape[]> {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) throw new ResourceNotFoundException('Product', 'id', productId);

    const catId = categoryId && categoryId > 0 ? categoryId : product.category?.id;
    const qb = this.products.createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('category.parent', 'parent')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.images', 'images')
      .where('p.isActive = :active', { active: true })
      .andWhere('p.id != :id', { id: productId });

    if (catId) {
      const ids = await this.resolveCategoryIds(catId);
      qb.andWhere('category.id IN (:...ids)', { ids });
    }
    qb.orderBy('p.soldCount', 'DESC').take(8);
    return this.mapList(await qb.getMany());
  }

  async getLowStock(threshold: number): Promise<ProductResponseShape[]> {
    const items = await this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('category.parent', 'parent')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.images', 'images')
      .where('p.isActive = :active', { active: true })
      .andWhere('p.stockQuantity <= :threshold', { threshold })
      .orderBy('p.stockQuantity', 'ASC')
      .getMany();
    return this.mapList(items);
  }

  async create(request: ProductRequest): Promise<ProductResponseShape> {
    const category = await this.requireCategory(request.categoryId);
    const brand = request.brandId ? await this.requireBrand(request.brandId) : null;

    const product = this.products.create({
      name: request.name,
      description: request.description ?? null,
      shortDescription: request.shortDescription ?? null,
      author: request.author ?? null,
      publisher: request.publisher ?? null,
      isbn: request.isbn ?? null,
      price: request.price,
      discountPrice: request.discountPrice ?? null,
      discountPercent: request.discountPercent ?? 0,
      stockQuantity: request.stockQuantity ?? 0,
      imageUrl: request.imageUrl ?? null,
      category,
      brand,
      specifications: request.specifications ?? null,
      pageCount: request.pageCount ?? null,
      publishedYear: request.publishedYear ?? null,
      language: request.language ?? 'Vietnamese',
      weightGrams: request.weightGrams ?? null,
      dimensions: request.dimensions ?? null,
      isFeatured: request.isFeatured ?? false,
      isBestseller: request.isBestseller ?? false,
      isNew: request.isNew ?? true,
      isActive: true,
      sortOrder: request.sortOrder ?? 0,
    });
    product.calculateDiscountPrice();
    const saved = await this.products.save(product);
    await this.replaceImages(saved, request.images);
    await this.refreshRating(saved.id);
    return this.getByIdAnyState(saved.id);
  }

  async update(id: number, request: ProductRequest): Promise<ProductResponseShape> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new ResourceNotFoundException('Product', 'id', id);

    if (request.categoryId != null) product.category = await this.requireCategory(request.categoryId);
    if (request.brandId != null) product.brand = await this.requireBrand(request.brandId);
    for (const key of [
      'name', 'description', 'shortDescription', 'author', 'publisher', 'isbn',
      'price', 'discountPrice', 'discountPercent', 'stockQuantity', 'imageUrl',
      'specifications', 'pageCount', 'publishedYear', 'language', 'weightGrams',
      'dimensions', 'isFeatured', 'isBestseller', 'isNew', 'sortOrder',
    ] as const) {
      if (request[key] !== undefined) (product as any)[key] = request[key];
    }

    product.calculateDiscountPrice();
    await this.products.save(product);
    if (request.images !== undefined) await this.replaceImages(product, request.images);
    await this.refreshRating(id);
    return this.getByIdAnyState(id);
  }

  async softDelete(id: number): Promise<void> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new ResourceNotFoundException('Product', 'id', id);
    product.isActive = false;
    await this.products.save(product);
  }

  async findByIsbn(isbn: string): Promise<Product | null> {
    return this.products.findOne({ where: { isbn, isActive: true } });
  }

  async countActive(): Promise<number> {
    return this.products.count({ where: { isActive: true } });
  }

  async countLowStock(threshold: number): Promise<number> {
    return this.products
      .createQueryBuilder('p')
      .where('p.isActive = :active', { active: true })
      .andWhere('p.stockQuantity <= :threshold', { threshold })
      .getCount();
  }

  async topByOrderCount(limit: number): Promise<Product[]> {
    return this.products.find({
      where: { isActive: true },
      order: { soldCount: 'DESC', viewCount: 'DESC' },
      take: limit,
    });
  }

  async refreshRating(productId: number): Promise<void> {
    const stats = await this.reviews
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(r.id)', 'cnt')
      .where('r.product.id = :id', { id: productId })
      .andWhere('r.isApproved = true AND r.isHidden = false')
      .getRawOne<{ avg: string | null; cnt: string }>();
    await this.products.update(productId, {
      avgRating: stats?.avg ? Number(stats.avg) : 0,
      reviewCount: stats ? Number(stats.cnt) : 0,
    });
  }

  private async replaceImages(product: Product, images?: string[]): Promise<void> {
    if (images === undefined) return;
    await this.images.delete({ product: { id: product.id } });
    const rows = (images || []).map((url) =>
      this.images.create({ product, imageUrl: url }),
    );
    if (rows.length) await this.images.save(rows);
  }

  async resolveCategoryIds(categoryId: number): Promise<number[]> {
    const all = await this.categories.find({ relations: ['parent'] });
    const byParent = new Map<number, Category[]>();
    for (const c of all) {
      const pid = c.parent?.id;
      if (pid) {
        const list = byParent.get(pid) ?? [];
        list.push(c);
        byParent.set(pid, list);
      }
    }
    if (!all.some((c) => c.id === categoryId)) {
      throw new ResourceNotFoundException('Category', 'id', categoryId);
    }
    const ids: number[] = [];
    const walk = (id: number) => {
      ids.push(id);
      for (const sub of byParent.get(id) ?? []) {
        if (sub.isActive) walk(sub.id);
      }
    };
    walk(categoryId);
    return ids;
  }

  private async requireCategory(id: number): Promise<Category> {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new ResourceNotFoundException('Category', 'id', id);
    return category;
  }

  private async requireBrand(id: number): Promise<Brand> {
    const brand = await this.brands.findOne({ where: { id } });
    if (!brand) throw new ResourceNotFoundException('Brand', 'id', id);
    return brand;
  }

  private applySort(qb: SelectQueryBuilder<Product>, sortBy?: string, direction?: string): void {
    const dir = direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const key = (sortBy || 'createdAt').trim();
    switch (key) {
      case 'newest':
        qb.orderBy('p.createdAt', 'DESC');
        break;
      case 'price_asc':
        qb.orderBy('p.price', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('p.price', 'DESC');
        break;
      case 'name_asc':
        qb.orderBy('p.name', 'ASC');
        break;
      default:
        qb.orderBy(`p.${SORTABLE_FIELDS.has(key) ? key : 'createdAt'}`, dir);
    }
  }

  private async mapOne(product: Product): Promise<ProductResponseShape> {
    const pricing = await this.pricing.resolve(product);
    return toProductResponse(product, pricing);
  }

  private async mapList(products: Product[]): Promise<ProductResponseShape[]> {
    const pricing = await this.pricing.resolveAll(products);
    return products.map((p) => toProductResponse(p, pricing.get(p.id)!));
  }
}
