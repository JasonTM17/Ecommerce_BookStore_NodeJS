import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from './user.entity';

@Entity('book_clubs')
export class BookClub {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text',  name: 'cover_image', nullable: true })
  coverImage: string | null;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @ManyToOne(() => Product, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'current_book_id' })
  currentBook: Product | null;

  @Column({ name: 'member_count', default: 0 })
  memberCount: number;

  @Column({ name: 'is_public', default: true })
  isPublic: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
