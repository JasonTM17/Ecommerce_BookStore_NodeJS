import { Controller, Get, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { BadRequestException, ResourceNotFoundException } from '../../common/exceptions';
import { Product } from '../../entities/product.entity';

function assertIsbn(isbn: string): string {
  const normalized = (isbn ?? '').replace(/[-\s]/g, '');
  if (!/^\d{10}(\d{3})?$/.test(normalized) && !/^\d{9}[\dXx]$/.test(normalized)) {
    throw new BadRequestException('ISBN không hợp lệ');
  }
  return normalized;
}

/**
 * Frontend-only endpoints (no Java counterpart): local-catalog ISBN lookup
 * and price comparison against the catalog product.
 */
@Public()
@Controller('isbn')
export class IsbnController {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  @Get('lookup/:isbn')
  async lookup(@Param('isbn') isbn: string) {
    const normalized = assertIsbn(isbn);
    const product = await this.products.findOne({ where: { isbn: normalized } })
      ?? await this.products.findOne({ where: { isbn } });
    if (!product) {
      throw new ResourceNotFoundException('Product', 'isbn', isbn);
    }
    return ApiResponse.success({
      isbn: product.isbn,
      title: product.name,
      authors: product.author ? [product.author] : [],
      publisher: product.publisher ?? '',
      publishedDate: product.publishedYear ? String(product.publishedYear) : '',
      description: product.shortDescription ?? product.description ?? '',
      imageUrl: product.imageUrl ?? '',
      pageCount: product.pageCount ?? 0,
      categories: product.category ? [product.category.name] : [],
      language: product.language ?? 'vi',
      productId: product.id,
      price: product.currentPrice,
      inStock: product.inStock,
    });
  }

  @Get('compare/:isbn')
  async compare(@Param('isbn') isbn: string) {
    const normalized = assertIsbn(isbn);
    const product = await this.products.findOne({ where: { isbn: normalized } })
      ?? await this.products.findOne({ where: { isbn } });
    if (!product) {
      return ApiResponse.success({
        isbn: normalized,
        found: false,
        ourPrice: null,
        currency: 'VND',
        product: null,
      });
    }
    return ApiResponse.success({
      isbn: product.isbn,
      found: true,
      ourPrice: product.currentPrice,
      originalPrice: product.price,
      discountPercent: product.discountPercent,
      currency: 'VND',
      inStock: product.inStock,
      product: {
        id: product.id,
        name: product.name,
        author: product.author,
        imageUrl: product.imageUrl,
      },
    });
  }
}
