import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryAction } from './enums';
import { Product } from './product.entity';
import { User } from './user.entity';

@Entity('inventory_logs')
export class InventoryLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'action', type: 'varchar', length: 20 })
  action: InventoryAction;

  @Column({ name: 'quantity_change' })
  quantityChange: number;

  @Column({ name: 'stock_before' })
  stockBefore: number;

  @Column({ name: 'stock_after' })
  stockAfter: number;

  @Column({ type: 'text',  nullable: true })
  reason: string | null;

  @Column({ type: 'int',  name: 'reference_id', nullable: true })
  referenceId: number | null;

  @Column({ type: 'text',  name: 'reference_type', nullable: true })
  referenceType: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
