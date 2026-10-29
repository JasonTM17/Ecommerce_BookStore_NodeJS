import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ReadingStatus } from './enums';
import { Product } from './product.entity';
import { User } from './user.entity';

@Entity('reading_progress')
@Unique(['user', 'product'])
export class ReadingProgress {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 20, default: ReadingStatus.WANT_TO_READ })
  status: ReadingStatus;

  @Column({ name: 'current_page', default: 0 })
  currentPage: number;

  @Column({ type: 'int',  name: 'total_pages', nullable: true })
  totalPages: number | null;

  @Column({ name: 'progress_percent', default: 0 })
  progressPercent: number;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'int',  nullable: true })
  rating: number | null;

  @Column({ type: 'text', nullable: true })
  review: string | null;

  @Column({ name: 'reading_notes', type: 'text', nullable: true })
  readingNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  updateProgress(currentPage: number): void {
    this.currentPage = currentPage;
    const total = this.totalPages ?? 0;
    if (total > 0) {
      this.progressPercent = Math.floor((currentPage * 100) / total);
    }
    if (!this.startedAt) {
      this.startedAt = new Date();
    }
    if (total > 0 && currentPage >= total) {
      this.status = ReadingStatus.FINISHED;
      this.finishedAt = new Date();
    } else {
      this.status = ReadingStatus.READING;
    }
  }
}
