import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import {
  BadRequestException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { PasswordResetToken } from '../../entities/password-reset-token.entity';
import { User } from '../../entities/user.entity';
import { EmailService } from '../email/email.service';
import {
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from './dto/auth.dto';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Always succeeds silently for unknown emails to prevent account
   * enumeration. The emailed token is stored only as a SHA-256 hash.
   */
  async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
    const email = request.email.toLowerCase().trim();
    const user = await this.users.findOne({ where: { email } });
    if (!user) return;

    await this.resetTokens.delete({ email });

    const rawToken = randomBytes(32).toString('hex');
    const entity = this.resetTokens.create({
      token: createHash('sha256').update(rawToken, 'utf8').digest('hex'),
      email,
      expiryDate: new Date(Date.now() + PasswordResetToken.EXPIRATION_HOURS * 3600_000),
      isUsed: false,
    });
    await this.resetTokens.save(entity);

    const delivered = await this.emailService.sendPasswordResetEmail(email, rawToken);
    if (!delivered) {
      this.logger.warn(
        `Password reset token created for ${email} but email delivery is unavailable`,
      );
    }
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    const hashed = createHash('sha256').update(request.token, 'utf8').digest('hex');
    const stored = await this.resetTokens.findOne({
      where: { token: hashed, isUsed: false, expiryDate: MoreThan(new Date()) },
    });
    if (!stored) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.users.findOne({ where: { email: stored.email } });
    if (!user) {
      throw new ResourceNotFoundException('User', 'email', stored.email);
    }

    user.passwordHash = await bcrypt.hash(request.newPassword, 12);
    await this.users.save(user);

    stored.isUsed = true;
    await this.resetTokens.save(stored);
  }
}
