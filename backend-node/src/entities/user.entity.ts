import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './enums';
import { Address } from './address.entity';
import { UserRole } from './user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  /** Maps Java's `full_name` column (User.firstName field). */
  @Column({ name: 'full_name' })
  firstName: string;

  /**
   * Java keeps lastName transient (never persisted). The Node schema stores it
   * so profile updates survive reloads; response shape is unchanged.
   */
  @Column({ type: 'text',  name: 'last_name', nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar',  name: 'phone', length: 20, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'text',  name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @OneToMany(() => UserRole, (userRole) => userRole.user, {
    cascade: true,
    eager: true,
  })
  roles: UserRole[];

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  get fullName(): string {
    const first = this.firstName || '';
    const last = this.lastName || '';
    return last ? `${first} ${last}` : first;
  }

  get roleNames(): Role[] {
    return (this.roles || []).map((r) => r.role);
  }

  hasRole(role: Role): boolean {
    return this.roleNames.includes(role);
  }
}
