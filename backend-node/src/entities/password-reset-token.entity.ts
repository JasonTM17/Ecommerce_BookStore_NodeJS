import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('password_reset_tokens')
@Index('idx_password_reset_token', ['token'], { unique: true })
@Index('idx_password_reset_email', ['email'])
export class PasswordResetToken {
  static readonly EXPIRATION_HOURS = 1;

  @PrimaryGeneratedColumn()
  id: number;

  /** SHA-256 hash of the emailed token (Java stored raw values). */
  @Column({ unique: true, length: 500 })
  token: string;

  @Column({ length: 255 })
  email: string;

  @Column({ name: 'expiry_date', type: 'timestamp' })
  expiryDate: Date;

  @Column({ name: 'is_used', default: false })
  isUsed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  isExpired(): boolean {
    return new Date() > this.expiryDate;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isUsed;
  }
}
