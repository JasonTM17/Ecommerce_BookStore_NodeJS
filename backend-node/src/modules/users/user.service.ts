import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { toPageResponse, PageResponse } from '../../common/dto/page-response.dto';
import {
  ConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { toUserResponse, UserResponseShape } from '../../common/mappers';
import { Role } from '../../entities/enums';
import { UserRole } from '../../entities/user-role.entity';
import { User } from '../../entities/user.entity';
import { UserUpdateRequest } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserRole) private readonly userRoles: Repository<UserRole>,
  ) {}

  async getAllUsers(page: number, size: number): Promise<PageResponse<UserResponseShape>> {
    const [users, total] = await this.users.findAndCount({
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return toPageResponse(users.map((u) => toUserResponse(u, true)), total, page, size);
  }

  async getUserById(id: number): Promise<UserResponseShape> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new ResourceNotFoundException('User', 'id', id);
    return toUserResponse(user, true);
  }

  async updateUser(id: number, request: UserUpdateRequest): Promise<UserResponseShape> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new ResourceNotFoundException('User', 'id', id);
    await this.applyProfileUpdate(user, request);
    return toUserResponse(await this.users.save(user), true);
  }

  async updateProfile(user: User, request: UserUpdateRequest): Promise<UserResponseShape> {
    await this.applyProfileUpdate(user, request);
    return toUserResponse(await this.users.save(user), true);
  }

  async updateUserRole(id: number, roles: Role[]): Promise<UserResponseShape> {
    const user = await this.users.findOne({ where: { id }, relations: ['roles'] });
    if (!user) throw new ResourceNotFoundException('User', 'id', id);

    const valid = new Set<string>(Object.values(Role));
    const sanitized = (roles || []).filter((r) => valid.has(r as string));
    if (sanitized.length === 0) {
      throw new ConflictException('Vai trò không hợp lệ');
    }

    await this.users.manager.transaction(async (em) => {
      await em.delete(UserRole, { user: { id: user.id } });
      for (const role of new Set(sanitized)) {
        await em.save(em.create(UserRole, { user, role }));
      }
    });

    const reloaded = await this.users.findOneOrFail({ where: { id }, relations: ['roles'] });
    return toUserResponse(reloaded, true);
  }

  async deactivateUser(id: number): Promise<void> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new ResourceNotFoundException('User', 'id', id);
    user.isActive = false;
    await this.users.save(user);
  }

  async activateUser(id: number): Promise<void> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new ResourceNotFoundException('User', 'id', id);
    user.isActive = true;
    await this.users.save(user);
  }

  async searchUsers(keyword: string, page: number, size: number): Promise<PageResponse<UserResponseShape>> {
    const pattern = `%${keyword}%`;
    const [users, total] = await this.users.findAndCount({
      where: [
        { email: ILike(pattern) },
        { firstName: ILike(pattern) },
      ],
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return toPageResponse(users.map((u) => toUserResponse(u, true)), total, page, size);
  }

  /** Shared by /users/me PUT and admin update paths (Java updateProfile). */
  async applyProfileUpdate(user: User, request: UserUpdateRequest): Promise<void> {
    if (request.email != null && request.email !== user.email) {
      const email = request.email.toLowerCase().trim();
      const existing = await this.users.findOne({ where: { email } });
      if (existing) throw new ConflictException('Email đã được sử dụng');
      user.email = email;
    }
    if (request.firstName != null) user.firstName = request.firstName;
    if (request.lastName != null) user.lastName = request.lastName;
    if (request.phoneNumber != null) user.phoneNumber = request.phoneNumber;
    if (request.avatarUrl != null) user.avatarUrl = request.avatarUrl;
    if (request.dateOfBirth != null) user.dateOfBirth = request.dateOfBirth;
  }
}
