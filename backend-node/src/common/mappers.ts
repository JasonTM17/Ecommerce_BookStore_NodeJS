import { Role } from '../entities/enums';
import { User } from '../entities/user.entity';

export interface UserResponseShape {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  isEmailVerified?: boolean;
  roles?: string[];
  dateOfBirth?: string | null;
  createdAt?: Date;
}

/**
 * Mirrors UserResponse DTO. `detailed` includes the fields populated by
 * AuthService/UserService; order/cart/lookup paths in Java omit them.
 */
export function toUserResponse(user: User, detailed = false): UserResponseShape {
  const base: UserResponseShape = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? '',
    fullName: user.fullName,
  };
  if (detailed) {
    base.phoneNumber = user.phoneNumber ?? null;
    base.avatarUrl = user.avatarUrl ?? null;
    base.isActive = user.isActive;
    base.isEmailVerified = user.isEmailVerified;
    base.roles = (user.roles || []).map((r) => r.role as Role);
    base.dateOfBirth = user.dateOfBirth ?? null;
    base.createdAt = user.createdAt;
  } else {
    base.phoneNumber = user.phoneNumber ?? null;
  }
  return base;
}

export function toReviewUserResponse(user: User): UserResponseShape {
  const fullName = user.fullName.trim() || 'Người dùng';
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? '',
    fullName,
    avatarUrl: user.avatarUrl ?? null,
  };
}
