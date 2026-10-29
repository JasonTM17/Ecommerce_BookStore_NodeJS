import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { toUserResponse, UserResponseShape } from '../../common/mappers';
import {
  BadRequestException,
  ConflictException,
} from '../../common/exceptions';
import { Cart } from '../../entities/cart.entity';
import { Role } from '../../entities/enums';
import { UserRole } from '../../entities/user-role.entity';
import { User } from '../../entities/user.entity';
import { EmailService } from '../email/email.service';
import {
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
} from './dto/auth.dto';
import { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';

export interface AuthResponseShape {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserResponseShape;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserRole) private readonly userRoles: Repository<UserRole>,
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly emailService: EmailService,
  ) {}

  async register(request: RegisterRequest): Promise<AuthResponseShape> {
    const email = request.email.toLowerCase().trim();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(request.password, BCRYPT_ROUNDS);
    const user = await this.users.manager.transaction(async (em) => {
      const saved = await em.save(
        em.create(User, {
          email,
          passwordHash,
          firstName: request.firstName,
          lastName: request.lastName,
          phoneNumber: request.phoneNumber ?? null,
          isActive: true,
          isEmailVerified: false,
        }),
      );
      await em.save(em.create(UserRole, { user: saved, role: Role.CUSTOMER }));
      await em.save(em.create(Cart, { user: saved }));
      return saved;
    });

    const reloaded = await this.users.findOneOrFail({
      where: { id: user.id },
      relations: ['roles'],
    });

    const accessToken = this.tokenService.generateAccessToken(reloaded);
    const { rawToken } = await this.refreshTokenService.createRefreshToken(
      reloaded,
      'Web Browser',
      null,
    );

    // Welcome email is best-effort; delivery failure must not break sign-up.
    try {
      await this.emailService.sendWelcomeEmail(reloaded.email, reloaded.firstName);
    } catch (error) {
      this.logger.warn(`Welcome email failed for ${reloaded.email}`);
    }

    return this.buildAuthResponse(reloaded, accessToken, rawToken);
  }

  async login(request: LoginRequest): Promise<AuthResponseShape> {
    const email = request.email.toLowerCase().trim();
    const user = await this.users.findOne({
      where: { email },
      relations: ['roles'],
    });

    // Constant-shape failure: same message for unknown user / wrong password /
    // disabled account, mirroring Spring's hidden-user-not-found behavior.
    const credentialsError = () =>
      new UnauthorizedException('Email hoặc mật khẩu không chính xác');

    if (!user) throw credentialsError();
    const matches = await bcrypt.compare(request.password, user.passwordHash);
    if (!matches || !user.isActive) throw credentialsError();

    const accessToken = this.tokenService.generateAccessToken(user);
    const { rawToken } = await this.refreshTokenService.createRefreshToken(
      user,
      'Web Browser',
      null,
    );

    return this.buildAuthResponse(user, accessToken, rawToken);
  }

  async refreshToken(request: RefreshTokenRequest): Promise<AuthResponseShape> {
    const stored = await this.refreshTokenService.verifyToken(request.refreshToken);
    const user = stored.user;

    if (!user.isActive) {
      throw new BadRequestException('Tài khoản đã bị vô hiệu hóa');
    }

    const { rawToken } = await this.refreshTokenService.rotateToken(
      request.refreshToken,
      request.deviceInfo ?? 'Web Browser',
      request.ipAddress ?? null,
    );
    const accessToken = this.tokenService.generateAccessToken(user);

    return this.buildAuthResponse(user, accessToken, rawToken);
  }

  async logout(rawRefreshToken?: string | null): Promise<void> {
    if (!rawRefreshToken) return;
    try {
      await this.refreshTokenService.revokeToken(rawRefreshToken);
    } catch (error) {
      this.logger.warn(`Could not revoke refresh token on logout: ${(error as Error).message}`);
    }
  }

  async changePassword(user: User, currentPassword: string, newPassword: string): Promise<void> {
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ');
    }
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.users.save(user);
    await this.refreshTokenService.revokeAllUserTokens(user.id);
  }

  private buildAuthResponse(user: User, accessToken: string, refreshToken: string): AuthResponseShape {
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokenService.getExpirationTime(),
      user: toUserResponse(user, true),
    };
  }
}
