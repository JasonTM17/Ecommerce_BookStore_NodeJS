import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartItem } from '../../entities/cart-item.entity';
import { Cart } from '../../entities/cart.entity';
import { CouponUsage } from '../../entities/coupon-usage.entity';
import { Coupon } from '../../entities/coupon.entity';
import { FlashSale } from '../../entities/flash-sale.entity';
import { InventoryLog } from '../../entities/inventory-log.entity';
import { Order } from '../../entities/order.entity';
import { PaymentTransaction } from '../../entities/payment-transaction.entity';
import { Product } from '../../entities/product.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { EmailModule } from '../email/email.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { FlashSaleController } from './flash-sale.controller';
import { FlashSaleService } from './flash-sale.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cart, CartItem, Order, Coupon, CouponUsage,
      FlashSale, InventoryLog, PaymentTransaction, Product,
    ]),
    CatalogModule,
    EmailModule,
  ],
  controllers: [
    CartController, OrderController, CouponController,
    FlashSaleController, InventoryController, PaymentController,
  ],
  providers: [
    CartService, OrderService, CouponService,
    FlashSaleService, InventoryService, PaymentService,
  ],
  exports: [CartService, OrderService, CouponService, InventoryService],
})
export class CommerceModule {}
