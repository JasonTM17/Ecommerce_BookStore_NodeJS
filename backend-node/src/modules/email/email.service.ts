import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { config } from '../../config/configuration';

/**
 * Email delivery is an optional capability: when MAIL_HOST/USERNAME/PASSWORD
 * are not configured the service reports disabled state and send attempts are
 * logged-and-skipped instead of fabricating success.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  get isEnabled(): boolean {
    return config.mail.enabled;
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.port === 465,
        auth: {
          user: config.mail.username,
          pass: config.mail.password,
        },
      });
    }
    return this.transporter;
  }

  private async send(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.warn(`Email service not configured; skipped "${subject}" to ${to}`);
      return false;
    }
    try {
      await this.getTransporter().sendMail({
        from: config.mail.from,
        to,
        subject,
        text,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to send "${subject}" to ${to}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async sendWelcomeEmail(to: string, firstName: string): Promise<boolean> {
    return this.send(
      to,
      'Chào mừng bạn đến với BookStore!',
      `Xin chào ${firstName},\n\nCảm ơn bạn đã đăng ký tài khoản BookStore. Chúc bạn có trải nghiệm mua sắm vui vẻ!\n\nBookStore Team`,
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    const resetLink = `${config.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    return this.send(
      to,
      'Đặt lại mật khẩu BookStore',
      `Bạn vừa yêu cầu đặt lại mật khẩu.\n\nNhấn vào liên kết sau để đặt mật khẩu mới (hết hạn sau 1 giờ):\n${resetLink}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
    );
  }

  async sendOrderConfirmationEmail(to: string, orderData: Record<string, unknown>): Promise<boolean> {
    const orderNumber = orderData['orderNumber'] ?? '';
    const total = orderData['totalAmount'] ?? '';
    return this.send(
      to,
      `Xác nhận đơn hàng ${orderNumber}`,
      `Cảm ơn bạn đã đặt hàng tại BookStore!\n\nĐơn hàng: ${orderNumber}\nTổng tiền: ${total}\n\nChúng tôi sẽ thông báo khi đơn hàng được giao.`,
    );
  }

  async sendOrderStatusUpdateEmail(to: string, statusData: Record<string, unknown>): Promise<boolean> {
    const orderNumber = statusData['orderNumber'] ?? '';
    const status = statusData['status'] ?? '';
    return this.send(
      to,
      `Cập nhật đơn hàng ${orderNumber}`,
      `Đơn hàng ${orderNumber} của bạn hiện đang ở trạng thái: ${status}`,
    );
  }

  async sendNewsletterEmail(to: string, data: Record<string, unknown>): Promise<boolean> {
    const title = data['featuredBookTitle'] ?? 'sách mới';
    return this.send(
      to,
      'BookStore Weekly Newsletter',
      `Sách nổi bật tuần này: ${title}\n\nGhé BookStore để khám phá thêm!`,
    );
  }
}
