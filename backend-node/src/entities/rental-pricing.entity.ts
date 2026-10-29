import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

const decimalTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? v : Number(v)),
};

@Entity('rental_pricing')
export class RentalPricing {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'daily_rate', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  dailyRate: number | null;

  @Column({ name: 'weekly_rate', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  weeklyRate: number | null;

  @Column({ name: 'monthly_rate', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  monthlyRate: number | null;

  @Column({ name: 'deposit_percent', default: 50 })
  depositPercent: number;

  @Column({ name: 'is_available_for_rental', default: false })
  isAvailableForRental: boolean;
}
