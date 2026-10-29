import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { config } from '../../config/configuration';
import { User } from '../../entities/user.entity';

export interface AccessTokenPayload {
  sub: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  generateAccessToken(user: User): string {
    const payload: AccessTokenPayload = {
      sub: user.email,
      roles: user.roleNames,
    };
    return this.jwt.sign(payload, {
      secret: config.jwt.secret,
      expiresIn: Math.floor(config.jwt.expirationMs / 1000),
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      return this.jwt.verify<AccessTokenPayload>(token, {
        secret: config.jwt.secret,
      });
    } catch {
      return null;
    }
  }

  /** Milliseconds until access-token expiry (mirrors JwtTokenProvider#getExpirationTime). */
  getExpirationTime(): number {
    return config.jwt.expirationMs;
  }
}
