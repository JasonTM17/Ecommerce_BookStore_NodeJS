import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from './user.entity';
import { WishlistNotification } from './wishlist-notification.entity';

@Entity('wishlists')
@Unique(['user', 'product'])
export class Wishlist {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: 0 })
  priority: number;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => WishlistNotification, (n) => n.wishlist)
  notifications: WishlistNotification[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
