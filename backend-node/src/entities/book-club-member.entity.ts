import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BookClub } from './book-club.entity';
import { BookClubRole } from './enums';
import { User } from './user.entity';

@Entity('book_club_members')
export class BookClubMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BookClub, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'club_id' })
  club: BookClub;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20, default: BookClubRole.MEMBER })
  role: BookClubRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
