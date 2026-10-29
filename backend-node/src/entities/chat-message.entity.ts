import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatConversation } from './chat-conversation.entity';
import { MessageRole } from './enums';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ChatConversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ChatConversation;

  @Column({ type: 'varchar', length: 15 })
  role: MessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int',  name: 'token_count', nullable: true })
  tokenCount: number | null;

  @Column({ name: 'is_from_grok', default: false })
  isFromGrok: boolean;

  @Column({ type: 'text',  name: 'model_used', nullable: true })
  modelUsed: string | null;

  @Column({ name: 'latency_ms', type: 'bigint', nullable: true, transformer: {
    to: (v: number | null) => v,
    from: (v: string | null) => (v === null ? v : Number(v)),
  } })
  latencyMs: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
