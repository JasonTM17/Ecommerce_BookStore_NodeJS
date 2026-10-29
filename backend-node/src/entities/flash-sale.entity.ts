import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

const decimalTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? v : Number(v)),
};

@Entity('flash_sales')
export class FlashSale {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'original_price', type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  originalPrice: number;

  @Column({ name: 'sale_price', type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  salePrice: number;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp' })
  endTime: Date;

  @Column({ name: 'stock_limit', default: 0 })
  stockLimit: number;

  @Column({ name: 'sold_count', default: 0 })
  soldCount: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'max_per_user', default: 1 })
  maxPerUser: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  get remainingStock(): number {
    return this.stockLimit - this.soldCount;
  }

  get discountPercentValue(): number {
    if (!this.originalPrice || this.originalPrice === 0) return 0;
    return Math.round(((this.originalPrice - this.salePrice) / this.originalPrice) * 10000) / 100;
  }

  isCurrentlyActive(referenceTime: Date = new Date()): boolean {
    if (!this.startTime || !this.endTime) return false;
    return (
      this.isActive === true &&
      referenceTime >= this.startTime &&
      referenceTime < this.endTime &&
      this.remainingStock > 0
    );
  }

  isUpcoming(referenceTime: Date = new Date()): boolean {
    if (!this.startTime) return false;
    return this.isActive === true && referenceTime < this.startTime;
  }
}
