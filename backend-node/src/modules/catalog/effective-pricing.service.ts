import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { FlashSale } from '../../entities/flash-sale.entity';
import { Product } from '../../entities/product.entity';

export interface EffectiveProductPricing {
  originalPrice: number;
  discountPrice: number | null;
  currentPrice: number;
  discountPercent: number;
  stockQuantity: number;
  inStock: boolean;
  activeFlashSale: FlashSale | null;
}

/**
 * Port of EffectivePricingService: active flash-sale pricing wins and clamps
 * effective stock to min(product stock, flash-sale remaining stock); otherwise
 * product discount pricing applies.
 */
@Injectable()
export class EffectivePricingService {
  constructor(
    @InjectRepository(FlashSale)
    private readonly flashSales: Repository<FlashSale>,
  ) {}

  async resolve(product: Product): Promise<EffectiveProductPricing> {
    const map = await this.resolveAll([product]);
    return map.get(product.id)!;
  }

  async resolveAll(products: Iterable<Product>): Promise<Map<number, EffectiveProductPricing>> {
    const candidates = [...products].filter((p) => p != null && p.id != null);
    const result = new Map<number, EffectiveProductPricing>();
    if (candidates.length === 0) return result;

    const now = new Date();
    const ids = [...new Set(candidates.map((p) => p.id))];

    const activeSales = await this.flashSales.find({
      where: {
        product: { id: In(ids) },
        isActive: true,
        startTime: LessThanOrEqual(now),
        endTime: MoreThan(now),
      },
      order: { id: 'ASC' },
    });

    const saleByProduct = new Map<number, FlashSale>();
    for (const sale of activeSales) {
      const productId = sale.product.id;
      if (sale.remainingStock > 0 && !saleByProduct.has(productId)) {
        saleByProduct.set(productId, sale);
      }
    }

    for (const product of candidates) {
      result.set(product.id, this.buildPricing(product, saleByProduct.get(product.id) ?? null));
    }
    return result;
  }

  private buildPricing(product: Product, sale: FlashSale | null): EffectiveProductPricing {
    const originalPrice = product.price ?? 0;

    if (sale) {
      const salePrice = sale.salePrice ?? 0;
      const remaining = Math.max(
        0,
        Math.min(Math.max(product.stockQuantity ?? 0, 0), sale.remainingStock),
      );
      return {
        originalPrice,
        discountPrice: salePrice,
        currentPrice: salePrice,
        discountPercent: this.resolveDiscountPercent(originalPrice, salePrice),
        stockQuantity: remaining,
        inStock: remaining > 0,
        activeFlashSale: sale,
      };
    }

    const currentPrice = product.currentPrice;
    const discountPrice =
      product.discountPrice != null && product.discountPrice > 0
        ? product.discountPrice
        : null;
    const stock = Math.max(product.stockQuantity ?? 0, 0);
    const storedPercent = product.discountPercent;

    return {
      originalPrice,
      discountPrice,
      currentPrice,
      discountPercent:
        storedPercent != null && storedPercent > 0
          ? storedPercent
          : this.resolveDiscountPercent(originalPrice, currentPrice),
      stockQuantity: stock,
      inStock: stock > 0,
      activeFlashSale: null,
    };
  }

  private resolveDiscountPercent(original: number, current: number): number {
    if (!original || original <= 0 || current >= original) return 0;
    return Math.round(((original - current) * 100) / original);
  }
}
