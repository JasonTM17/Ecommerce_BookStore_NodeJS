import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { Product } from '../../entities/product.entity';
import { Review } from '../../entities/review.entity';
import { Wishlist } from '../../entities/wishlist.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Wishlist, Product, Order]),
    CatalogModule,
  ],
  controllers: [ReviewController, WishlistController],
  providers: [ReviewService, WishlistService],
  exports: [ReviewService],
})
export class EngagementModule {}
