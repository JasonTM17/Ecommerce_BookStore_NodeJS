import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { toUserResponse } from '../../common/mappers';
import { CartItem } from '../../entities/cart-item.entity';
import { Cart } from '../../entities/cart.entity';
import { Product } from '../../entities/product.entity';
import { User } from '../../entities/user.entity';
import { toProductResponse } from '../catalog/catalog.mappers';
import { EffectivePricingService } from '../catalog/effective-pricing.service';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly pricing: EffectivePricingService,
  ) {}

  async getCartResponse(user: User) {
    const cart = await this.getOrCreateCart(user);
    return this.buildResponse(cart, user);
  }

  async addItem(user: User, productId: number, quantity: number) {
    if (!quantity || quantity <= 0) {
      throw new BadRequestException('Số lượng phải lớn hơn 0');
    }
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product || !product.isActive) {
      throw new ResourceNotFoundException('Product', 'id', productId);
    }
    const cart = await this.getOrCreateCart(user);

    const existing = cart.cartItems.find((i) => i.product.id === productId);
    const newQty = (existing?.quantity ?? 0) + quantity;
    await this.assertPurchasable(product, newQty);

    if (existing) {
      existing.quantity = newQty;
      await this.items.save(existing);
    } else {
      const item = this.items.create({ cart, product, quantity });
      cart.cartItems.push(item);
      await this.items.save(item);
    }
    return this.buildResponse(await this.getOrCreateCart(user), user);
  }

  async updateItem(user: User, itemId: number, quantity: number) {
    const cart = await this.getOrCreateCart(user);
    const item = cart.cartItems.find((i) => i.id === itemId);
    if (!item) throw new ResourceNotFoundException('CartItem', 'id', itemId);
    if (quantity <= 0) {
      await this.items.remove(item);
    } else {
      await this.assertPurchasable(item.product, quantity);
      item.quantity = quantity;
      await this.items.save(item);
    }
    return this.buildResponse(await this.getOrCreateCart(user), user);
  }

  async removeItem(user: User, itemId: number) {
    const cart = await this.getOrCreateCart(user);
    const item = cart.cartItems.find((i) => i.id === itemId);
    if (!item) throw new ResourceNotFoundException('CartItem', 'id', itemId);
    await this.items.remove(item);
    return this.buildResponse(await this.getOrCreateCart(user), user);
  }

  async clearCart(user: User): Promise<void> {
    const cart = await this.carts.findOne({ where: { user: { id: user.id } } });
    if (cart) {
      await this.items.delete({ cart: { id: cart.id } });
    }
  }

  /** Used by OrderService inside the checkout transaction. */
  async getOrCreateCart(user: User): Promise<Cart> {
    let cart = await this.carts.findOne({
      where: { user: { id: user.id } },
      relations: ['cartItems', 'cartItems.product'],
      order: { cartItems: { addedAt: 'ASC' } },
    });
    if (!cart) {
      cart = await this.carts.save(this.carts.create({ user }));
      cart.cartItems = [];
    }
    cart.cartItems = cart.cartItems || [];
    return cart;
  }

  private async assertPurchasable(product: Product, quantity: number): Promise<void> {
    const pricing = await this.pricing.resolve(product);
    if (pricing.stockQuantity <= 0) {
      throw new BadRequestException(`Sản phẩm "${product.name}" đã hết hàng`);
    }
    if (quantity > pricing.stockQuantity) {
      throw new BadRequestException(
        `Sản phẩm "${product.name}" chỉ còn ${pricing.stockQuantity} sản phẩm`,
      );
    }
    if (pricing.activeFlashSale && quantity > pricing.activeFlashSale.maxPerUser) {
      throw new BadRequestException(
        `Sản phẩm "${product.name}" giới hạn ${pricing.activeFlashSale.maxPerUser} sản phẩm mỗi khách hàng trong đợt giảm giá`,
      );
    }
  }

  private async buildResponse(cart: Cart, user: User) {
    const items = cart.cartItems || [];
    const products = items.map((i) => i.product);
    const pricingMap = await this.pricing.resolveAll(products);

    const itemResponses = items.map((item, idx) => {
      const pricing = pricingMap.get(item.product.id)!;
      const subtotal = Math.round(pricing.currentPrice * item.quantity * 100) / 100;
      return {
        id: item.id,
        product: toProductResponse(item.product, pricing, false),
        quantity: item.quantity,
        subtotal,
        sortOrder: item.sortOrder ?? idx,
      };
    });

    const subtotal = Math.round(itemResponses.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
    return {
      id: cart.id,
      user: toUserResponse(user),
      items: itemResponses,
      totalItems: itemResponses.reduce((s, i) => s + i.quantity, 0),
      subtotal,
      total: subtotal,
    };
  }
}
