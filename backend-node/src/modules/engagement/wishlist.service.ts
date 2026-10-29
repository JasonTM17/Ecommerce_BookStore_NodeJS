import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { Product } from '../../entities/product.entity';
import { User } from '../../entities/user.entity';
import { Wishlist } from '../../entities/wishlist.entity';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(Wishlist) private readonly wishlists: Repository<Wishlist>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async add(user: User, productId: number) {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) throw new ResourceNotFoundException('Product', 'id', productId);

    const existing = await this.wishlists.findOne({
      where: { user: { id: user.id }, product: { id: productId } },
    });
    if (existing) {
      throw new ConflictException('Sản phẩm đã có trong danh sách yêu thích');
    }
    const item = this.wishlists.create({ user, product });
    return this.toResponse(await this.wishlists.save(item));
  }

  async getWishlist(user: User, page?: number, size?: number) {
    if (page != null && size != null) {
      const [items] = await this.wishlists.findAndCount({
        where: { user: { id: user.id } },
        relations: ['product'],
        order: { createdAt: 'DESC' },
        skip: page * size,
        take: size,
      });
      return items.map((w) => this.toResponse(w));
    }
    const items = await this.wishlists.find({
      where: { user: { id: user.id } },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
    return items.map((w) => this.toResponse(w));
  }

  async isInWishlist(user: User, productId: number): Promise<boolean> {
    return (await this.wishlists.count({
      where: { user: { id: user.id }, product: { id: productId } },
    })) > 0;
  }

  async count(user: User): Promise<number> {
    return this.wishlists.count({ where: { user: { id: user.id } } });
  }

  async remove(user: User, productId: number): Promise<void> {
    const item = await this.wishlists.findOne({
      where: { user: { id: user.id }, product: { id: productId } },
    });
    if (!item) throw new ResourceNotFoundException('Wishlist', 'productId', productId);
    await this.wishlists.remove(item);
  }

  async updateNotes(user: User, productId: number, notes: string): Promise<void> {
    const item = await this.requireItem(user, productId);
    item.notes = notes;
    await this.wishlists.save(item);
  }

  async updatePriority(user: User, productId: number, priority: number): Promise<void> {
    const item = await this.requireItem(user, productId);
    item.priority = priority;
    await this.wishlists.save(item);
  }

  private async requireItem(user: User, productId: number): Promise<Wishlist> {
    const item = await this.wishlists.findOne({
      where: { user: { id: user.id }, product: { id: productId } },
    });
    if (!item) throw new ResourceNotFoundException('Wishlist', 'productId', productId);
    return item;
  }

  private toResponse(item: Wishlist) {
    const p = item.product;
    return {
      id: item.id,
      product: {
        id: p.id,
        name: p.name,
        author: p.author,
        imageUrl: p.imageUrl,
        price: p.price,
        currentPrice: p.currentPrice,
        avgRating: p.avgRating,
        reviewCount: p.reviewCount,
        stockQuantity: p.stockQuantity,
        discountPercent: p.discountPercent,
        isNew: p.isNew,
        isBestseller: p.isBestseller,
      },
      notes: item.notes,
      priority: item.priority,
      sortOrder: item.sortOrder,
      isInStock: (p.stockQuantity ?? 0) > 0,
      createdAt: item.createdAt,
    };
  }
}
