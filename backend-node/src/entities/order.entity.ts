import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus, PaymentStatus } from './enums';
import { OrderItem } from './order-item.entity';
import { User } from './user.entity';

const decimalTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? v : Number(v)),
};

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_number', unique: true, length: 50 })
  orderNumber: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'order_status', type: 'varchar', length: 20, default: OrderStatus.PENDING })
  orderStatus: OrderStatus;

  @Column({ name: 'payment_status', type: 'varchar', length: 25, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  orderItems: OrderItem[];

  @Column({ name: 'shipping_address', type: 'text', nullable: true })
  shippingAddress: string | null;

  @Column({ type: 'varchar',  name: 'shipping_phone', length: 20, nullable: true })
  shippingPhone: string | null;

  @Column({ type: 'varchar',  name: 'shipping_receiver_name', length: 200, nullable: true })
  shippingReceiverName: string | null;

  @Column({ type: 'varchar',  name: 'shipping_method', length: 100, nullable: true })
  shippingMethod: string | null;

  @Column({ name: 'shipping_fee', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  shippingFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  subtotal: number | null;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  taxAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalTransformer })
  discountAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  totalAmount: number | null;

  @Column({ type: 'varchar',  name: 'payment_method', length: 50, nullable: true })
  paymentMethod: string | null;

  @Column({ type: 'varchar',  name: 'payment_transaction_id', length: 200, nullable: true })
  paymentTransactionId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'estimated_delivery', type: 'timestamp', nullable: true })
  estimatedDelivery: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text',  name: 'cancel_reason', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
