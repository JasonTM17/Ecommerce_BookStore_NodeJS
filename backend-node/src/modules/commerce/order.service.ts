import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { toPageResponse, PageResponse } from '../../common/dto/page-response.dto';
import {
  BadRequestException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { toUserResponse } from '../../common/mappers';
import { CartItem } from '../../entities/cart-item.entity';
import { Cart } from '../../entities/cart.entity';
import {
  OrderStatus,
  PaymentStatus,
  Role,
} from '../../entities/enums';
import { FlashSale } from '../../entities/flash-sale.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { Order } from '../../entities/order.entity';
import { Product } from '../../entities/product.entity';
import { User } from '../../entities/user.entity';
import { EffectivePricingService } from '../catalog/effective-pricing.service';
import { toProductResponse } from '../catalog/catalog.mappers';

const TAX_RATE = 0.1;
const FREE_SHIPPING_THRESHOLD = 200000;
const SHIPPING_FEE = 25000;

export interface OrderItemRequestInput {
  productId: number;
  quantity: number;
}

export interface OrderRequestInput {
  items: OrderItemRequestInput[];
  shippingAddress: string;
  shippingPhone: string;
  shippingReceiverName: string;
  shippingMethod?: string;
  paymentMethod?: string;
  notes?: string;
}

@Injectable()
export class OrderService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly pricing: EffectivePricingService,
  ) {}

  /**
   * Creates an order inside a DB transaction. Stock is guarded by a
   * conditional decrement (`stock_quantity >= requested`) so two concurrent
   * checkouts cannot oversell — the loser rolls the whole order back.
   * Flash-sale inventory is guarded the same way on `sold_count`.
   */
  async createOrder(user: User, request: OrderRequestInput) {
    if (!request.items?.length) {
      throw new BadRequestException('Đơn hàng phải có ít nhất một sản phẩm');
    }

    return this.dataSource.transaction(async (em) => {
      const productIds = [...new Set(request.items.map((i) => i.productId))];

      // Pessimistic row locks serialize concurrent checkouts on the same rows.
      const products = await em
        .createQueryBuilder(Product, 'p')
        .setLock('pessimistic_write')
        .where('p.id IN (:...ids)', { ids: productIds })
        .getMany();
      const byId = new Map(products.map((p) => [p.id, p]));

      const pricingMap = await this.pricing.resolveAll(products, em);

      const order = em.create(Order, {
        orderNumber: this.generateOrderNumber(),
        user,
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        shippingAddress: request.shippingAddress,
        shippingPhone: request.shippingPhone,
        shippingReceiverName: request.shippingReceiverName,
        shippingMethod: request.shippingMethod ?? null,
        paymentMethod: request.paymentMethod ?? null,
        notes: request.notes ?? null,
        shippingFee: 0,
        taxAmount: 0,
        discountAmount: 0,
      });
      order.orderItems = [];

      let subtotal = 0;
      for (const itemRequest of request.items) {
        const product = byId.get(itemRequest.productId);
        if (!product) {
          throw new ResourceNotFoundException('Product', 'id', itemRequest.productId);
        }
        if (!product.isActive) {
          throw new BadRequestException(`Sản phẩm '${product.name}' không còn hoạt động`);
        }
        const pricing = pricingMap.get(product.id)!;
        this.validateRequestedQuantity(product, pricing, itemRequest.quantity);

        const item = em.create(OrderItem, {
          product,
          quantity: itemRequest.quantity,
          price: pricing.currentPrice,
          discountPercent: 0,
        });
        item.calculateSubtotal();
        order.orderItems.push(item);
        subtotal = Math.round((subtotal + (item.subtotal ?? 0)) * 100) / 100;

        await this.decrementStock(em, product, itemRequest.quantity);
        product.soldCount = (product.soldCount ?? 0) + itemRequest.quantity;
        await em.save(product);

        if (pricing.activeFlashSale) {
          await this.decrementFlashSale(em, pricing.activeFlashSale.id, itemRequest.quantity);
        }
      }

      order.subtotal = subtotal;
      order.shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
      order.taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
      order.totalAmount = Math.round(
        (subtotal + order.shippingFee + order.taxAmount - order.discountAmount) * 100,
      ) / 100;
      order.estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const saved = await em.save(order);

      const cart = await em.findOne(Cart, { where: { user: { id: user.id } } });
      if (cart) {
        await em.delete(CartItem, { cart: { id: cart.id } });
      }

      return this.mapToOrderResponse(await this.loadOrder(em, saved.id), undefined, em);
    });
  }

  /**
   * Atomic conditional decrement used by checkout and tested by the
   * stock-concurrency regression: `UPDATE ... SET stock = stock - ? WHERE
   * stock >= ?`. Returns the post-decrement stock or throws when insufficient.
   */
  async decrementStock(em: EntityManager, product: Product, quantity: number): Promise<void> {
    const result = await em
      .createQueryBuilder()
      .update(Product)
      .set({ stockQuantity: () => 'stock_quantity - :qty' })
      .where('id = :id AND stock_quantity >= :qty', { id: product.id, qty: quantity })
      .execute();
    if (!result.affected) {
      throw new BadRequestException(`Sản phẩm '${product.name}' không đủ số lượng trong kho`);
    }
    product.stockQuantity -= quantity;
  }

  private async decrementFlashSale(em: EntityManager, saleId: number, quantity: number): Promise<void> {
    const result = await em
      .createQueryBuilder()
      .update(FlashSale)
      .set({ soldCount: () => 'sold_count + :qty' })
      .where('id = :id AND sold_count + :qty <= stock_limit', { id: saleId, qty: quantity })
      .execute();
    if (!result.affected) {
      throw new BadRequestException('Số lượng flash sale còn lại không đủ');
    }
  }

  async getOrderById(user: User, orderId: number) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['orderItems', 'orderItems.product', 'user', 'user.roles'],
    });
    if (!order) throw new ResourceNotFoundException('Order', 'id', orderId);

    const isAdmin = (user.roles || []).some((r) => r.role === Role.ADMIN);
    if (order.user.id !== user.id && !isAdmin) {
      throw new BadRequestException('Bạn không có quyền xem đơn hàng này');
    }
    return this.mapToOrderResponse(order);
  }

  async getUserOrders(user: User, page: number, size: number): Promise<PageResponse<unknown>> {
    const [orders, total] = await this.orders.findAndCount({
      where: { user: { id: user.id } },
      relations: ['orderItems', 'orderItems.product', 'user'],
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return toPageResponse(await this.mapOrders(orders), total, page, size);
  }

  async getAllOrders(page: number, size: number, status?: OrderStatus): Promise<PageResponse<unknown>> {
    const [orders, total] = await this.orders.findAndCount({
      where: status ? { orderStatus: status } : {},
      relations: ['orderItems', 'orderItems.product', 'user'],
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return toPageResponse(await this.mapOrders(orders), total, page, size);
  }

  async getAdminOrderById(orderId: number) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['orderItems', 'orderItems.product', 'user'],
    });
    if (!order) throw new ResourceNotFoundException('Order', 'id', orderId);
    return this.mapToOrderResponse(order);
  }

  async updateOrderStatus(orderId: number, newStatus: OrderStatus) {
    return this.dataSource.transaction(async (em) => {
      const order = await em.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new ResourceNotFoundException('Order', 'id', orderId);

      order.orderStatus = newStatus;
      if (newStatus === OrderStatus.DELIVERED) {
        order.deliveredAt = new Date();
      } else if (newStatus === OrderStatus.CANCELLED) {
        order.cancelledAt = new Date();
        const fullOrder = await this.loadOrder(em, order.id);
        for (const item of fullOrder.orderItems || []) {
          const product = await em.findOne(Product, {
            where: { id: item.product.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (product?.isActive) {
            product.stockQuantity += item.quantity;
            await em.save(product);
          }
        }
      }
      await em.save(order);
      return this.mapToOrderResponse(await this.loadOrder(em, order.id), undefined, em);
    });
  }

  async updatePaymentStatus(orderId: number, paymentStatus: PaymentStatus) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['orderItems', 'orderItems.product', 'user'],
    });
    if (!order) throw new ResourceNotFoundException('Order', 'id', orderId);
    order.paymentStatus = paymentStatus;
    await this.orders.save(order);
    return this.mapToOrderResponse(await this.loadOrder(this.orders.manager, orderId));
  }

  async countAll(): Promise<number> {
    return this.orders.count();
  }

  async countByStatus(...statuses: OrderStatus[]): Promise<number> {
    return this.orders.count({ where: { orderStatus: In(statuses) } });
  }

  async countCreatedSince(since: Date): Promise<number> {
    return this.orders
      .createQueryBuilder('o')
      .where('o.createdAt >= :since', { since })
      .getCount();
  }

  async sumDelivered(): Promise<number> {
    const r = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.totalAmount), 0)', 'total')
      .where('o.orderStatus = :s', { s: OrderStatus.DELIVERED })
      .getRawOne<{ total: string }>();
    return Number(r?.total ?? 0);
  }

  async sumDeliveredBetween(from: Date, to: Date): Promise<number> {
    const r = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.totalAmount), 0)', 'total')
      .where('o.orderStatus = :s', { s: OrderStatus.DELIVERED })
      .andWhere('o.createdAt >= :from AND o.createdAt < :to', { from, to })
      .getRawOne<{ total: string }>();
    return Number(r?.total ?? 0);
  }

  private validateRequestedQuantity(product: Product, pricing: any, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Số lượng không hợp lệ');
    }
    if (pricing.activeFlashSale) {
      if (quantity > pricing.activeFlashSale.maxPerUser) {
        throw new BadRequestException(
          `Flash sale cho sản phẩm '${product.name}' chỉ cho phép mua tối đa ${pricing.activeFlashSale.maxPerUser} cuốn`,
        );
      }
      if (quantity > pricing.stockQuantity) {
        throw new BadRequestException('Số lượng flash sale còn lại không đủ');
      }
      return;
    }
    if (quantity > pricing.stockQuantity) {
      throw new BadRequestException(`Sản phẩm '${product.name}' không đủ số lượng trong kho`);
    }
  }

  private generateOrderNumber(): string {
    const timestamp = String(Date.now());
    const uuid = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `ORD${timestamp.substring(timestamp.length - 8)}${uuid}`;
  }

  private async loadOrder(em: EntityManager, id: number): Promise<Order> {
    return em.findOneOrFail(Order, {
      where: { id },
      relations: ['orderItems', 'orderItems.product', 'user'],
    });
  }

  private async mapOrders(orders: Order[]) {
    const products = orders.flatMap((o) => (o.orderItems || []).map((i) => i.product));
    const pricingMap = await this.pricing.resolveAll(products);
    return Promise.all(orders.map((o) => this.mapToOrderResponse(o, pricingMap)));
  }

  private async mapToOrderResponse(order: Order, pricingMap?: Map<number, any>, manager?: EntityManager) {
    const items = order.orderItems || [];
    if (!pricingMap) {
      pricingMap = await this.pricing.resolveAll(items.map((i) => i.product), manager);
    }
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      user: toUserResponse(order.user),
      orderStatus: order.orderStatus,
      // Java uses `orderStatus.name()` for the display name — raw enum name.
      orderStatusDisplayName: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentStatusDisplayName: order.paymentStatus,
      orderItems: items.map((item) => ({
        id: item.id,
        product: toProductResponse(item.product, pricingMap!.get(item.product.id)!, false),
        quantity: item.quantity,
        price: item.price,
        discountPercent: item.discountPercent,
        subtotal: item.subtotal,
        sortOrder: item.sortOrder,
      })),
      shippingAddress: order.shippingAddress,
      shippingPhone: order.shippingPhone,
      shippingReceiverName: order.shippingReceiverName,
      shippingMethod: order.shippingMethod,
      shippingFee: order.shippingFee,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      estimatedDelivery: order.estimatedDelivery,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      sortOrder: order.sortOrder,
      createdAt: order.createdAt,
    };
  }
}
