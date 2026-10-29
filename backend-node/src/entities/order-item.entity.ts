import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from './product.entity';

const decimalTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? v : Number(v)),
};

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.orderItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Product, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  price: number;

  @Column({ name: 'discount_percent', default: 0 })
  discountPercent: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  subtotal: number | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  calculateSubtotal(): void {
    const discount = this.discountPercent > 0 ? (this.price * this.discountPercent) / 100 : 0;
    const actualPrice = this.price - discount;
    this.subtotal = Math.round(actualPrice * this.quantity * 100) / 100;
  }
}
