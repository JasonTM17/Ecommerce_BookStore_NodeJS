import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { BadRequestException, ForbiddenException } from '../../common/exceptions';
import { config } from '../../config/configuration';
import { Role } from '../../entities/enums';
import { EmailService } from './email.service';

/**
 * Mirrors EmailTestController: the entire controller is gated by
 * APP_EMAIL_TEST_ENABLED (dev-only), admin-only, and recipients are
 * allow-listed via APP_EMAIL_ALLOWED_RECIPIENTS.
 */
@Controller('email')
@Roles(Role.ADMIN)
export class EmailTestController {
  constructor(private readonly emailService: EmailService) {}

  @Get('health')
  healthCheck() {
    const enabled = config.mail.testEndpointsEnabled;
    return ApiResponse.success({
      testEndpointEnabled: enabled,
      message: enabled
        ? 'Email test endpoints are ENABLED (dev only!)'
        : 'Email test endpoints are DISABLED',
      allowedRecipients: config.mail.allowedTestRecipients.join(',') || null,
    });
  }

  @Post('test/send')
  async sendTestEmail(@Body() request: {
    to?: string; type?: string; firstName?: string; resetToken?: string;
  }) {
    this.assertEnabled();
    const to = (request?.to ?? '').trim().toLowerCase();
    this.assertRecipient(to);

    const type = (request?.type ?? '').toLowerCase();
    switch (type) {
      case 'welcome':
        await this.emailService.sendWelcomeEmail(to, request.firstName || 'Test User');
        break;
      case 'password-reset':
        await this.emailService.sendPasswordResetEmail(
          to, request.resetToken || `test-reset-token-${Date.now()}`,
        );
        break;
      case 'order':
        await this.emailService.sendOrderConfirmationEmail(to, {
          customerName: request.firstName || 'Test User',
          orderNumber: `BK-TEST-${Date.now()}`,
          totalAmount: '150.000đ',
          paymentMethod: 'COD',
        });
        break;
      case 'order-status':
        await this.emailService.sendOrderStatusUpdateEmail(to, {
          orderNumber: `BK-TEST-${Date.now()}`,
          status: 'Đang giao hàng',
        });
        break;
      case 'newsletter':
        await this.emailService.sendNewsletterEmail(to, { featuredBookTitle: 'Sách mới' });
        break;
      default:
        throw new BadRequestException(
          `Unknown email type: ${request?.type}. Valid types: welcome, password-reset, order, order-status, newsletter`,
        );
    }
    return ApiResponse.success(
      `Email queued successfully! Type: ${type}`,
      `Email đang được gửi đến ${to}`,
    );
  }

  @Post('test/send-all')
  async sendAllEmailTypes(@Query('to') to = 'test@example.com') {
    this.assertEnabled();
    const recipient = to.trim().toLowerCase();
    this.assertRecipient(recipient);

    const results: Record<string, string> = {};
    const attempt = async (key: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        results[key] = '✅ Queued';
      } catch (e) {
        results[key] = `❌ Failed: ${(e as Error).message}`;
      }
    };

    await attempt('welcome', () => this.emailService.sendWelcomeEmail(recipient, 'Test User'));
    await attempt('password-reset', () =>
      this.emailService.sendPasswordResetEmail(recipient, `test-token-${Date.now()}`));
    await attempt('order', () =>
      this.emailService.sendOrderConfirmationEmail(recipient, {
        orderNumber: `BK-TEST-${Date.now()}`, totalAmount: '150.000đ', paymentMethod: 'COD',
      }));
    await attempt('order-status', () =>
      this.emailService.sendOrderStatusUpdateEmail(recipient, {
        orderNumber: `BK-TEST-${Date.now()}`, status: 'Đang giao hàng',
      }));
    await attempt('newsletter', () =>
      this.emailService.sendNewsletterEmail(recipient, { featuredBookTitle: 'Sách mới' }));

    return ApiResponse.success(results, 'Tất cả email đã được gửi!');
  }

  @Post('test/newsletter-weekly')
  async triggerWeeklyNewsletter() {
    this.assertEnabled();
    // No scheduled job in Node; send the newsletter template once when SMTP is configured.
    const sent = await this.emailService.sendNewsletterEmail(
      config.mail.from,
      { featuredBookTitle: 'Sách mới' },
    );
    return ApiResponse.success(
      sent ? 'Weekly newsletter job triggered!' : 'Email provider not configured; nothing sent',
    );
  }

  private assertEnabled(): void {
    if (!config.mail.testEndpointsEnabled) {
      throw new ForbiddenException('Email test endpoints are disabled');
    }
  }

  private assertRecipient(to: string): void {
    const allowed = config.mail.allowedTestRecipients;
    if (allowed.length > 0 && !allowed.includes(to)) {
      throw new ForbiddenException('Recipient not allowed for test emails');
    }
    if (!to || !to.includes('@')) {
      throw new BadRequestException('Recipient email is invalid');
    }
  }
}
