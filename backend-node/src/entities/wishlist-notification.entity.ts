import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Wishlist } from './wishlist.entity';

@Entity('wishlist_notifications')
export class WishlistNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Wishlist, (w) => w.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wishlist_id' })
  wishlist: Wishlist;

  @Column({ type: 'text',  nullable: true })
  type: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'is_sent', default: false })
  isSent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
