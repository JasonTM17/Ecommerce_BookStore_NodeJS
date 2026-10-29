import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenService } from '../../modules/auth/token.service';
import { User } from '../../entities/user.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global JWT guard. Routes marked @Public() skip authentication; every other
 * route requires a valid Bearer access token and a still-active user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();

    const authHeader: string | undefined = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : undefined;

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Unauthorized');
    }

    const payload = this.tokenService.verifyAccessToken(token);
    if (!payload) {
      if (isPublic) return true;
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.users.findOne({
      where: { email: payload.sub },
      relations: ['roles'],
    });

    if (!user || !user.isActive) {
      if (isPublic) return true;
      throw new UnauthorizedException('Unauthorized');
    }

    request.user = user;
    return true;
  }
}
