import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { BookDiscussion } from './book-discussion.entity';
import { User } from './user.entity';

/**
 * Tracks per-user likes so `isLiked` and idempotent like/unlike semantics work.
 * Additive to the Java schema (which only keeps a counter).
 */
@Entity('book_discussion_likes')
@Unique(['discussion', 'user'])
export class BookDiscussionLike {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BookDiscussion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'discussion_id' })
  discussion: BookDiscussion;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
