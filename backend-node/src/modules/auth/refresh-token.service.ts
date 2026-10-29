import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { BadRequestException } from '../../common/exceptions';
import { config } from '../../config/configuration';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { User } from '../../entities/user.entity';

const MAX_TOKENS_PER_USER = 5;

/**
 * Refresh tokens are opaque random values. Only their SHA-256 hash is stored,
 * so a database read never exposes a usable credential.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
  ) {}

  static hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  async createRefreshToken(
    user: User,
    deviceInfo?: string | null,
    ipAddress?: string | null,
  ): Promise<{ entity: RefreshToken; rawToken: string }> {
    const rawToken = `${randomUUID()}-${randomUUID()}`;

    const tokenCount = await this.tokens.count({ where: { user: { id: user.id } } });
    if (tokenCount >= MAX_TOKENS_PER_USER) {
      const oldest = await this.tokens.find({
        where: { user: { id: user.id } },
        order: { createdAt: 'ASC' },
        take: tokenCount - MAX_TOKENS_PER_USER + 1,
      });
      if (oldest.length > 0) await this.tokens.remove(oldest);
    }

    const entity = this.tokens.create({
      token: RefreshTokenService.hashToken(rawToken),
      user,
      expiryDate: new Date(Date.now() + config.jwt.refreshExpirationMs),
      deviceInfo: deviceInfo ?? null,
      ipAddress: ipAddress ?? null,
      isRevoked: false,
    });
    return { entity: await this.tokens.save(entity), rawToken };
  }

  async verifyToken(rawToken: string): Promise<RefreshToken> {
    const stored = await this.tokens.findOne({
      where: {
        token: RefreshTokenService.hashToken(rawToken),
        isRevoked: false,
        expiryDate: MoreThan(new Date()),
      },
      relations: ['user', 'user.roles'],
    });
    if (!stored) {
      throw new BadRequestException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
    return stored;
  }

  async rotateToken(
    oldRawToken: string,
    deviceInfo?: string | null,
    ipAddress?: string | null,
  ): Promise<{ entity: RefreshToken; rawToken: string }> {
    const oldToken = await this.verifyToken(oldRawToken);
    oldToken.isRevoked = true;
    await this.tokens.save(oldToken);
    return this.createRefreshToken(oldToken.user, deviceInfo, ipAddress);
  }

  async revokeToken(rawToken: string): Promise<void> {
    const stored = await this.tokens.findOne({
      where: { token: RefreshTokenService.hashToken(rawToken) },
    });
    if (!stored) {
      throw new BadRequestException('Token không tồn tại');
    }
    stored.isRevoked = true;
    await this.tokens.save(stored);
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.tokens.update(
      { user: { id: userId }, isRevoked: false },
      { isRevoked: true },
    );
  }
}
