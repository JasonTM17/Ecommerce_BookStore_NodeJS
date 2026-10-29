import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { Category } from '../../entities/category.entity';
import { Product } from '../../entities/product.entity';
import { toCategoryResponse } from './catalog.mappers';
import { CategoryRequest } from './dto/catalog.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async getAll() {
    const all = await this.categories.find({
      where: { isActive: true },
      relations: ['parent', 'subcategories'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return Promise.all(all.map((c) => this.toResponseWithCount(c)));
  }

  async getRoot() {
    const roots = await this.categories.find({
      where: { isActive: true, parent: IsNull() },
      relations: ['subcategories'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return Promise.all(roots.map((c) => this.toResponseWithCount(c)));
  }

  async getSubcategories(parentId: number) {
    const subs = await this.categories.find({
      where: { isActive: true, parent: { id: parentId } },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return Promise.all(subs.map((c) => this.toResponseWithCount(c)));
  }

  async getById(id: number) {
    const category = await this.categories.findOne({
      where: { id },
      relations: ['parent', 'subcategories'],
    });
    if (!category) throw new ResourceNotFoundException('Category', 'id', id);
    return this.toResponseWithCount(category);
  }

  async create(request: CategoryRequest) {
    if (await this.categories.findOne({ where: { name: request.name } })) {
      throw new ConflictException('Danh mục đã tồn tại');
    }
    const parent = request.parentId ? await this.requireCategory(request.parentId) : null;
    const category = this.categories.create({
      name: request.name,
      description: request.description ?? null,
      iconUrl: request.iconUrl ?? null,
      imageUrl: request.imageUrl ?? null,
      parent,
      sortOrder: request.sortOrder ?? 0,
      isActive: true,
    });
    return this.toResponseWithCount(await this.categories.save(category));
  }

  async update(id: number, request: CategoryRequest) {
    const category = await this.requireCategory(id);
    if (request.name != null && request.name !== category.name) {
      if (await this.categories.findOne({ where: { name: request.name } })) {
        throw new ConflictException('Danh mục đã tồn tại');
      }
      category.name = request.name;
    }
    if (request.description != null) category.description = request.description;
    if (request.iconUrl != null) category.iconUrl = request.iconUrl;
    if (request.imageUrl != null) category.imageUrl = request.imageUrl;
    if (request.sortOrder != null) category.sortOrder = request.sortOrder;

    if (request.parentId != null) {
      if (request.parentId === id) {
        throw new ConflictException('Danh mục không thể là danh mục cha của chính nó');
      }
      category.parent = await this.requireCategory(request.parentId);
    } else {
      category.parent = null;
    }
    return this.toResponseWithCount(await this.categories.save(category));
  }

  async softDelete(id: number): Promise<void> {
    const category = await this.requireCategory(id);
    category.isActive = false;
    await this.categories.save(category);
  }

  private async requireCategory(id: number): Promise<Category> {
    const category = await this.categories.findOne({
      where: { id },
      relations: ['parent', 'subcategories'],
    });
    if (!category) throw new ResourceNotFoundException('Category', 'id', id);
    return category;
  }

  private async toResponseWithCount(category: Category) {
    const ids = await this.collectCategoryIds(category.id);
    const productCount = ids.length
      ? await this.products.count({ where: { isActive: true, category: { id: ids.length === 1 ? ids[0] : undefined as any } } })
      : 0;
    // Use explicit count for multi-level sets.
    const count = ids.length
      ? await this.products
          .createQueryBuilder('p')
          .where('p.isActive = :active', { active: true })
          .andWhere('p.category.id IN (:...ids)', { ids })
          .getCount()
      : 0;
    return toCategoryResponse(category, count || productCount);
  }

  private async collectCategoryIds(rootId: number): Promise<number[]> {
    const all = await this.categories.find({ relations: ['parent'] });
    const byParent = new Map<number, number[]>();
    for (const c of all) {
      if (c.parent?.id) {
        const list = byParent.get(c.parent.id) ?? [];
        list.push(c.id);
        byParent.set(c.parent.id, list);
      }
    }
    const ids: number[] = [];
    const walk = (id: number) => {
      ids.push(id);
      for (const sub of byParent.get(id) ?? []) walk(sub);
    };
    walk(rootId);
    return ids;
  }
}
