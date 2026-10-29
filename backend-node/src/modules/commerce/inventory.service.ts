import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BadRequestException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { InventoryAction } from '../../entities/enums';
import { InventoryLog } from '../../entities/inventory-log.entity';
import { Product } from '../../entities/product.entity';
import { User } from '../../entities/user.entity';
import { ProductService } from '../catalog/product.service';
import { InventoryAdjustRequestDto } from './inventory.controller';

function toLogResponse(log: InventoryLog) {
  return {
    id: log.id,
    productId: log.product?.id ?? null,
    productName: log.product?.name ?? null,
    action: log.action,
    quantityChange: log.quantityChange,
    stockBefore: log.stockBefore,
    stockAfter: log.stockAfter,
    reason: log.reason,
    referenceId: log.referenceId,
    referenceType: log.referenceType,
    createdByName: log.createdBy ? log.createdBy.fullName : null,
    createdAt: log.createdAt,
  };
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(InventoryLog) private readonly logs: Repository<InventoryLog>,
    private readonly productService: ProductService,
  ) {}

  /**
   * Adjusts stock inside a transaction with a row lock. Negative adjustments
   * that would drive stock below zero are rejected atomically.
   */
  async adjust(user: User, request: InventoryAdjustRequestDto) {
    return this.dataSource.transaction(async (em) => {
      const product = await em.findOne(Product, {
        where: { id: request.productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new ResourceNotFoundException('Product', 'id', request.productId);

      const before = product.stockQuantity;
      const after = before + request.quantityChange;
      if (after < 0) {
        throw new BadRequestException(
          `Tồn kho không đủ: hiện có ${before}, cần ${-request.quantityChange}`,
        );
      }
      if (request.action === InventoryAction.INITIAL && before > 0) {
        // INITIAL is allowed anytime in Java; kept permissive but logged.
      }
      product.stockQuantity = after;
      await em.save(product);

      const log = em.create(InventoryLog, {
        product,
        action: request.action,
        quantityChange: request.quantityChange,
        stockBefore: before,
        stockAfter: after,
        reason: request.reason ?? null,
        createdBy: user,
      });
      const saved = await em.save(log);
      saved.product = product;
      saved.createdBy = user;
      return toLogResponse(saved);
    });
  }

  /** Records a stock movement; used by order/checkout flows. */
  async recordChange(
    product: Product,
    action: InventoryAction,
    quantityChange: number,
    stockBefore: number,
    reason: string | null,
    referenceId: number | null,
    referenceType: string | null,
    createdBy: User | null,
  ): Promise<InventoryLog> {
    const log = this.logs.create({
      product,
      action,
      quantityChange,
      stockBefore,
      stockAfter: stockBefore + quantityChange,
      reason,
      referenceId,
      referenceType,
      createdBy,
    });
    return this.logs.save(log);
  }

  async getLowStock(threshold: number) {
    return this.productService.getLowStock(threshold);
  }

  async getHistory(productId: number, page: number, size: number) {
    const [logs] = await this.logs.findAndCount({
      where: { product: { id: productId } },
      relations: ['createdBy', 'product'],
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return logs.map(toLogResponse);
  }

  async getLogs(page: number, size: number) {
    const [logs] = await this.logs.findAndCount({
      relations: ['createdBy', 'product'],
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return logs.map(toLogResponse);
  }
}
