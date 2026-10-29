import { Brand } from '../../entities/brand.entity';
import { Category } from '../../entities/category.entity';
import { FlashSale } from '../../entities/flash-sale.entity';
import { Product } from '../../entities/product.entity';
import { EffectiveProductPricing } from './effective-pricing.service';

export interface ProductResponseShape {
  id: number;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  author: string | null;
  publisher?: string | null;
  isbn?: string | null;
  price: number;
  discountPrice: number | null;
  discountPercent: number;
  currentPrice: number;
  stockQuantity: number;
  inStock: boolean;
  imageUrl: string | null;
  images?: string[];
  category?: unknown;
  brand?: unknown;
  specifications?: string | null;
  pageCount?: number | null;
  publishedYear?: number | null;
  language?: string | null;
  weightGrams?: number | null;
  dimensions?: string | null;
  avgRating?: number;
  reviewCount?: number;
  soldCount?: number;
  viewCount?: number;
  activeFlashSale?: {
    id: number;
    endTime: Date;
    remainingStock: number;
    stockLimit: number;
    soldCount: number;
    maxPerUser: number;
  } | null;
  isFeatured?: boolean;
  isBestseller?: boolean;
  isNew?: boolean;
  sortOrder?: number;
}

export function toCategoryResponse(
  category: Category,
  productCount = 0,
  includeSubcategories = true,
) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    iconUrl: category.iconUrl,
    imageUrl: category.imageUrl,
    parentId: category.parent ? category.parent.id : null,
    parentName: category.parent ? category.parent.name : null,
    subcategories:
      includeSubcategories && category.subcategories?.length
        ? category.subcategories
            .filter((s) => s.isActive)
            .map((s) => toCategoryResponse(s, 0, false))
        : undefined,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    productCount,
  };
}

export function toBrandResponse(brand: Brand, productCount = 0) {
  return {
    id: brand.id,
    name: brand.name,
    description: brand.description,
    logoUrl: brand.logoUrl,
    websiteUrl: brand.websiteUrl,
    isActive: brand.isActive,
    productCount,
  };
}

function toActiveFlashSaleSummary(sale: FlashSale | null) {
  if (!sale) return undefined;
  return {
    id: sale.id,
    endTime: sale.endTime,
    remainingStock: sale.remainingStock,
    stockLimit: sale.stockLimit,
    soldCount: sale.soldCount,
    maxPerUser: sale.maxPerUser,
  };
}

export function toProductResponse(
  product: Product,
  pricing: EffectiveProductPricing,
  detailed = true,
): ProductResponseShape {
  const base: ProductResponseShape = {
    id: product.id,
    name: product.name,
    author: product.author,
    imageUrl: product.imageUrl,
    price: pricing.originalPrice,
    discountPrice: pricing.discountPrice,
    discountPercent: pricing.discountPercent,
    currentPrice: pricing.currentPrice,
    stockQuantity: pricing.stockQuantity,
    inStock: pricing.inStock,
  };
  if (!detailed) return base;

  return {
    ...base,
    description: product.description,
    shortDescription: product.shortDescription,
    publisher: product.publisher,
    isbn: product.isbn,
    images: (product.images || []).map((i) => i.imageUrl),
    category: product.category ? toCategoryResponse(product.category) : null,
    brand: product.brand ? toBrandResponse(product.brand) : null,
    specifications: product.specifications,
    pageCount: product.pageCount,
    publishedYear: product.publishedYear,
    language: product.language,
    weightGrams: product.weightGrams,
    dimensions: product.dimensions,
    avgRating: product.avgRating,
    reviewCount: product.reviewCount,
    soldCount: product.soldCount,
    viewCount: product.viewCount,
    activeFlashSale: toActiveFlashSaleSummary(pricing.activeFlashSale),
    isFeatured: product.isFeatured,
    isBestseller: product.isBestseller,
    isNew: product.isNew,
    sortOrder: product.sortOrder,
  };
}
