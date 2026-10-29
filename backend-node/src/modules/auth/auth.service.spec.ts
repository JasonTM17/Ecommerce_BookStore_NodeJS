import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { BadRequestException, ConflictException } from '../../common/exceptions';
import { Role } from '../../entities/enums';

const mockRepo = () => ({
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  manager: { transaction: jest.fn(async (fn: any) => fn({ save: jest.fn(async (e) => e), create: (_t: any, d: any) => d, delete: jest.fn() })), create: (_t: any, d: any) => d },
});

const baseUser = {
  id: 1,
  email: 'user@test.dev',
  firstName: 'Test User',
  lastName: null,
  passwordHash: bcrypt.hashSync('correct-password', 4),
  isActive: true,
  isEmailVerified: true,
  roles: [{ role: Role.CUSTOMER }],
} as any;

function buildService(overrides: { users?: any } = {}) {
  const users = { ...mockRepo(), ...(overrides.users ?? {}) };
  const userRoles = mockRepo();
  const carts = mockRepo();
  const tokenService = {
    generateAccessToken: jest.fn(() => 'access.jwt'),
    getExpirationTime: jest.fn(() => 86400),
  };
  const refreshTokenService = {
    createRefreshToken: jest.fn(async () => ({ rawToken: 'raw-refresh' })),
    verifyToken: jest.fn(),
    rotateToken: jest.fn(async () => ({ rawToken: 'raw-refresh-2' })),
    revokeToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
  };
  const emailService = { sendWelcomeEmail: jest.fn(async () => true) };
  const service = new AuthService(
    users as any, userRoles as any, carts as any,
    tokenService as any, refreshTokenService as any, emailService as any,
  );
  return { service, users, refreshTokenService };
}

describe('AuthService negatives', () => {
  it('rejects login for unknown email with a generic credential error', async () => {
    const { service } = buildService({ users: { findOne: jest.fn(async () => null) } });
    await expect(
      service.login({ email: 'ghost@test.dev', password: 'x' } as any),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.login({ email: 'ghost@test.dev', password: 'x' } as any),
    ).rejects.toThrow('Email hoặc mật khẩu không chính xác');
  });

  it('rejects login with wrong password using the same generic message', async () => {
    const { service } = buildService({ users: { findOne: jest.fn(async () => baseUser) } });
    await expect(
      service.login({ email: baseUser.email, password: 'wrong' } as any),
    ).rejects.toThrow('Email hoặc mật khẩu không chính xác');
  });

  it('rejects login for a deactivated account', async () => {
    const inactive = { ...baseUser, isActive: false };
    const { service } = buildService({ users: { findOne: jest.fn(async () => inactive) } });
    await expect(
      service.login({ email: baseUser.email, password: 'correct-password' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects duplicate registration', async () => {
    const { service } = buildService({ users: { findOne: jest.fn(async () => baseUser) } });
    await expect(
      service.register({
        email: baseUser.email, password: 'password123',
        firstName: 'A', lastName: 'B',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects refresh with an unverifiable token', async () => {
    const { service, refreshTokenService } = buildService();
    refreshTokenService.verifyToken.mockRejectedValue(new BadRequestException('Token không hợp lệ'));
    await expect(
      service.refreshToken({ refreshToken: 'bogus' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects refresh for a deactivated user', async () => {
    const { service, refreshTokenService } = buildService();
    refreshTokenService.verifyToken.mockResolvedValue({
      user: { ...baseUser, isActive: false },
    });
    await expect(
      service.refreshToken({ refreshToken: 'still-valid' } as any),
    ).rejects.toThrow('Tài khoản đã bị vô hiệu hóa');
  });

  it('rejects changePassword with wrong current password', async () => {
    const { service } = buildService();
    await expect(
      service.changePassword(baseUser, 'wrong-current', 'new-password-1'),
    ).rejects.toThrow('Mật khẩu hiện tại không đúng');
  });

  it('rejects changePassword when new equals current', async () => {
    const { service } = buildService();
    await expect(
      service.changePassword(baseUser, 'correct-password', 'correct-password'),
    ).rejects.toThrow('Mật khẩu mới không được trùng với mật khẩu cũ');
  });
});
