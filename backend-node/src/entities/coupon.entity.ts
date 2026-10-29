import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CouponType } from './enums';

const decimalTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? v : Number(v)),
};

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ type: 'varchar',  length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'type', type: 'varchar', length: 20 })
  type: CouponType;

  @Column({ name: 'discount_value', type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  discountValue: number;

  @Column({ name: 'min_order_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  minOrderAmount: number;

  @Column({ name: 'max_discount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  maxDiscount: number;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate: Date | null;

  @Column({ name: 'usage_limit', default: 0 })
  usageLimit: number;

  @Column({ name: 'used_count', default: 0 })
  usedCount: number;

  @Column({ name: 'per_user_limit', default: 1 })
  perUserLimit: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'applicable_categories', type: 'text', nullable: true })
  applicableCategories: string | null;

  @Column({ name: 'applicable_products', type: 'text', nullable: true })
  applicableProducts: string | null;

  @Column({ name: 'is_public', default: true })
  isPublic: boolean;

  @Column({ type: 'int',  name: 'created_by', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  isValid(): boolean {
    if (!this.isActive) return false;
    const now = new Date();
    if (this.startDate && now < this.startDate) return false;
    if (this.endDate && now > this.endDate) return false;
    if (this.usageLimit > 0 && this.usedCount >= this.usageLimit) return false;
    return true;
  }

  isExpired(): boolean {
    return this.endDate != null && new Date() > this.endDate;
  }
}
