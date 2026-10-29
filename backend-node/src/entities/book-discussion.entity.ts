import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BookClub } from './book-club.entity';
import { Product } from './product.entity';
import { User } from './user.entity';

@Entity('book_discussions')
export class BookDiscussion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BookClub, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'club_id' })
  club: BookClub;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'likes_count', default: 0 })
  likesCount: number;

  @Column({ name: 'views_count', default: 0 })
  viewsCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
