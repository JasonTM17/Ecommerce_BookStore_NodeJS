import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
@Index('idx_refresh_token_token', ['token'], { unique: true })
@Index('idx_refresh_token_user', ['user'])
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Stores the SHA-256 hash of the issued token. The raw value is only ever
   * returned to the client; it is never persisted (Java stored it raw).
   */
  @Column({ unique: true, length: 500 })
  token: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'expiry_date', type: 'timestamp' })
  expiryDate: Date;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @Column({ type: 'varchar',  name: 'device_info', length: 255, nullable: true })
  deviceInfo: string | null;

  @Column({ type: 'varchar',  name: 'ip_address', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  isExpired(): boolean {
    return new Date() > this.expiryDate;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked;
  }
}
