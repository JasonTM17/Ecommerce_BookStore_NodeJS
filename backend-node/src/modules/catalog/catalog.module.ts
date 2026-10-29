import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from '../../entities/brand.entity';
import { Category } from '../../entities/category.entity';
import { FlashSale } from '../../entities/flash-sale.entity';
import { ProductImage } from '../../entities/product-image.entity';
import { Product } from '../../entities/product.entity';
import { Review } from '../../entities/review.entity';
import { BrandService } from './brand.service';
import { CatalogController } from './catalog.controller';
import { CategoryService } from './category.service';
import { EffectivePricingService } from './effective-pricing.service';
import { ProductService } from './product.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage, Category, Brand, FlashSale, Review]),
  ],
  controllers: [CatalogController],
  providers: [ProductService, CategoryService, BrandService, EffectivePricingService],
  exports: [ProductService, CategoryService, BrandService, EffectivePricingService],
})
export class CatalogModule {}
