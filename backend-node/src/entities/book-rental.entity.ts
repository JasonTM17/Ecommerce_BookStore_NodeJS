import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RentalStatus } from './enums';
import { Product } from './product.entity';
import { User } from './user.entity';

@Entity('book_rentals')
export class BookRental {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'int',  name: 'rental_days', nullable: true })
  rentalDays: number | null;

  @Column({ name: 'rental_fee', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: {
    to: (v: number | null) => v,
    from: (v: string | null) => (v === null ? v : Number(v)),
  } })
  rentalFee: number | null;

  @Column({ name: 'deposit_amount', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: {
    to: (v: number | null) => v,
    from: (v: string | null) => (v === null ? v : Number(v)),
  } })
  depositAmount: number | null;

  @Column({ name: 'rented_at', type: 'timestamp', nullable: true })
  rentedAt: Date | null;

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'returned_at', type: 'timestamp', nullable: true })
  returnedAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: RentalStatus.PENDING })
  status: RentalStatus;

  @Column({ name: 'overdue_fee', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: {
    to: (v: number | null) => v,
    from: (v: string | null) => (v === null ? v : Number(v)),
  } })
  overdueFee: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
