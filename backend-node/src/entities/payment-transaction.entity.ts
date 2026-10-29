import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod, PaymentStatus } from './enums';
import { Order } from './order.entity';

const decimalTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? v : Number(v)),
};

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'payment_method', type: 'varchar', length: 20 })
  paymentMethod: PaymentMethod;

  @Column({ name: 'payment_status', type: 'varchar', length: 25, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  amount: number;

  @Column({ type: 'text',  name: 'transaction_id', unique: true, nullable: true })
  transactionId: string | null;

  @Column({ type: 'text',  name: 'vnp_transaction_no', nullable: true })
  vnpTransactionNo: string | null;

  @Column({ type: 'text',  name: 'vnp_bank_code', nullable: true })
  vnpBankCode: string | null;

  @Column({ type: 'text',  name: 'vnp_card_type', nullable: true })
  vnpCardType: string | null;

  @Column({ name: 'payment_details', type: 'text', nullable: true })
  paymentDetails: string | null;

  @Column({ type: 'text',  name: 'vnp_response_code', nullable: true })
  vnpResponseCode: string | null;

  @Column({ type: 'text',  name: 'vnp_secure_hash', nullable: true })
  vnpSecureHash: string | null;

  @Column({ type: 'text',  name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'expired_at', type: 'timestamp', nullable: true })
  expiredAt: Date | null;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  refundAmount: number;

  @Column({ name: 'refunded_at', type: 'timestamp', nullable: true })
  refundedAt: Date | null;

  @Column({ type: 'text',  name: 'refund_reason', nullable: true })
  refundReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
