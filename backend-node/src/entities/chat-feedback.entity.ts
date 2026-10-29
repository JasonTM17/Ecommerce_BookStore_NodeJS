import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_feedback')
export class ChatFeedback {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => ChatMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: ChatMessage;

  @Column()
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'boolean',  name: 'is_helpful', nullable: true })
  isHelpful: boolean | null;

  @Column({ name: 'improvement_suggestion', type: 'text', nullable: true })
  improvementSuggestion: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
