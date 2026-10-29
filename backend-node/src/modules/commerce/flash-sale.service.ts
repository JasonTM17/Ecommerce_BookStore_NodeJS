import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { toSpringPage, SpringPage } from '../../common/dto/api-response.dto';
import {
  BadRequestException,
  ConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { FlashSale } from '../../entities/flash-sale.entity';
import { Product } from '../../entities/product.entity';

function toFlashSaleResponse(sale: FlashSale) {
  const now = new Date();
  return {
    id: sale.id,
    product: sale.product
      ? {
          id: sale.product.id,
          name: sale.product.name,
          author: sale.product.author,
          imageUrl: sale.product.imageUrl,
        }
      : null,
    originalPrice: sale.originalPrice,
    salePrice: sale.salePrice,
    discountPercent: sale.discountPercentValue,
    startTime: sale.startTime,
    endTime: sale.endTime,
    stockLimit: sale.stockLimit,
    soldCount: sale.soldCount,
    remainingStock: sale.remainingStock,
    isActive: sale.isActive,
    isCurrentlyActive: sale.isCurrentlyActive(now),
    isUpcoming: sale.isUpcoming(now),
    maxPerUser: sale.maxPerUser,
    createdAt: sale.createdAt,
  };
}

@Injectable()
export class FlashSaleService {
  constructor(
    @InjectRepository(FlashSale) private readonly flashSales: Repository<FlashSale>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async getActive() {
    const now = new Date();
    const sales = await this.flashSales.find({
      where: { isActive: true, startTime: LessThanOrEqual(now), endTime: MoreThan(now) },
      order: { endTime: 'ASC' },
    });
    return sales.filter((s) => s.remainingStock > 0).map(toFlashSaleResponse);
  }

  async getUpcoming() {
    const now = new Date();
    const sales = await this.flashSales.find({
      where: { isActive: true, startTime: MoreThan(now) },
      order: { startTime: 'ASC' },
    });
    return sales.map(toFlashSaleResponse);
  }

  async getById(id: number) {
    const sale = await this.flashSales.findOne({ where: { id } });
    if (!sale) throw new ResourceNotFoundException('FlashSale', 'id', id);
    return toFlashSaleResponse(sale);
  }

  async getAll(page: number, size: number): Promise<SpringPage<ReturnType<typeof toFlashSaleResponse>>> {
    const [sales, total] = await this.flashSales.findAndCount({
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return toSpringPage(sales.map(toFlashSaleResponse), total, page, size);
  }

  async create(request: any) {
    const product = await this.requireProduct(request.productId);
    this.assertValid(request);
    await this.assertNoOverlap(product.id, new Date(request.startTime), new Date(request.endTime));

    const sale = this.flashSales.create({
      product,
      originalPrice: request.originalPrice,
      salePrice: request.salePrice,
      startTime: new Date(request.startTime),
      endTime: new Date(request.endTime),
      stockLimit: request.stockLimit,
      maxPerUser: request.maxPerUser ?? 1,
      isActive: request.isActive ?? true,
    });
    return toFlashSaleResponse(await this.flashSales.save(sale));
  }

  async update(id: number, request: any) {
    const sale = await this.flashSales.findOne({ where: { id } });
    if (!sale) throw new ResourceNotFoundException('FlashSale', 'id', id);
    this.assertValid(request);
    const product = request.productId ? await this.requireProduct(request.productId) : sale.product;
    const start = request.startTime ? new Date(request.startTime) : sale.startTime;
    const end = request.endTime ? new Date(request.endTime) : sale.endTime;
    await this.assertNoOverlap(product.id, start, end, id);

    if (request.productId != null) sale.product = product;
    if (request.originalPrice != null) sale.originalPrice = request.originalPrice;
    if (request.salePrice != null) sale.salePrice = request.salePrice;
    if (request.startTime != null) sale.startTime = start;
    if (request.endTime != null) sale.endTime = end;
    if (request.stockLimit != null) sale.stockLimit = request.stockLimit;
    if (request.maxPerUser != null) sale.maxPerUser = request.maxPerUser;
    if (request.isActive != null) sale.isActive = request.isActive;
    return toFlashSaleResponse(await this.flashSales.save(sale));
  }

  async remove(id: number): Promise<void> {
    const sale = await this.flashSales.findOne({ where: { id } });
    if (!sale) throw new ResourceNotFoundException('FlashSale', 'id', id);
    sale.isActive = false;
    await this.flashSales.save(sale);
  }

  private async requireProduct(id: number): Promise<Product> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new ResourceNotFoundException('Product', 'id', id);
    return product;
  }

  private assertValid(request: any): void {
    const start = request.startTime ? new Date(request.startTime) : null;
    const end = request.endTime ? new Date(request.endTime) : null;
    if (start && end && end <= start) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }
    if (request.salePrice != null && request.originalPrice != null
        && request.salePrice >= request.originalPrice) {
      throw new BadRequestException('Giá sale phải nhỏ hơn giá gốc');
    }
    if (request.stockLimit != null && request.stockLimit <= 0) {
      throw new BadRequestException('Số lượng phải > 0');
    }
  }

  private async assertNoOverlap(productId: number, start: Date, end: Date, excludeId?: number): Promise<void> {
    const qb = this.flashSales
      .createQueryBuilder('s')
      .where('s.product.id = :productId', { productId })
      .andWhere('s.isActive = true')
      .andWhere('s.startTime < :end AND s.endTime > :start', { start, end });
    if (excludeId) qb.andWhere('s.id != :excludeId', { excludeId });
    if (await qb.getCount() > 0) {
      throw new ConflictException('Sản phẩm đã có flash sale trong khoảng thời gian này');
    }
  }
}
