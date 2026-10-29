import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomUUID } from 'crypto';
import {
  BadRequestException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { OrderStatus, PaymentMethod, PaymentStatus, Role } from '../../entities/enums';
import { Order } from '../../entities/order.entity';
import { PaymentTransaction } from '../../entities/payment-transaction.entity';
import { User } from '../../entities/user.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PaymentTransaction)
    private readonly transactions: Repository<PaymentTransaction>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly email: EmailService,
  ) {}

  private get merchantId(): string {
    return this.config.get<string>('vnpay.merchantId') ?? '';
  }

  private get merchantKey(): string {
    return this.config.get<string>('vnpay.merchantKey') ?? '';
  }

  private get vnpayUrl(): string {
    return this.config.get<string>('vnpay.url')
      ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  }

  private get returnUrl(): string {
    return this.config.get<string>('vnpay.returnUrl')
      ?? 'http://localhost:3001/payment/return';
  }

  isConfigured(): boolean {
    return (
      !!this.merchantId &&
      !this.merchantId.includes('your-merchant-id') &&
      !!this.merchantKey &&
      !this.merchantKey.includes('your-merchant-key')
    );
  }

  private validateConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('VNPay chưa được cấu hình trong môi trường hiện tại');
    }
  }

  async createPayment(user: User, orderId: number, ipAddress: string) {
    this.validateConfigured();
    const order = await this.findAuthorizedOrder(user, orderId);

    if (order.paymentMethod !== PaymentMethod.VNPAY) {
      throw new BadRequestException('Đơn hàng không hỗ trợ thanh toán VNPay');
    }

    let transaction = await this.transactions.findOne({
      where: { order: { id: orderId } },
      relations: ['order'],
    });
    if (!transaction) {
      transaction = this.transactions.create({
        order,
        paymentMethod: PaymentMethod.VNPAY,
        paymentStatus: PaymentStatus.PENDING,
        amount: order.totalAmount ?? 0,
        ipAddress,
      });
    }
    transaction.transactionId = this.generateTransactionId();
    transaction.expiredAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.transactions.save(transaction);

    const paymentUrl = this.buildPaymentUrl(order, transaction, ipAddress);
    return {
      success: true,
      orderId: order.id,
      transactionId: transaction.transactionId,
      paymentUrl,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      amount: order.totalAmount,
      expiresAt: transaction.expiredAt,
      message: 'Redirect to VNPay to complete payment',
    };
  }

  private buildPaymentUrl(order: Order, transaction: PaymentTransaction, ipAddress: string): string {
    const format = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    };
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.merchantId,
      vnp_Amount: String(Math.round((order.totalAmount ?? 0) * 100)),
      vnp_CurrCode: 'VND',
      vnp_BankCode: '',
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toán đơn hàng ${order.orderNumber}`,
      vnp_OrderType: 'bookstore',
      vnp_ReturnUrl: this.returnUrl,
      vnp_IpAddr: ipAddress || '127.0.0.1',
      vnp_CreateDate: format(new Date()),
      vnp_ExpireDate: format(transaction.expiredAt!),
      vnp_TxnRef: transaction.transactionId!,
    };
    const queryString = this.buildQueryString(this.sortParams(params));
    const secureHash = this.hmacSHA512(this.merchantKey, queryString);
    return `${this.vnpayUrl}?${queryString}&vnp_SecureHash=${secureHash}`;
  }

  async handleReturn(params: Record<string, string>) {
    const secureHash = params['vnp_SecureHash'];
    const transactionId = params['vnp_TxnRef'];
    const vnpResponseCode = params['vnp_ResponseCode'];
    const vnpTransactionNo = params['vnp_TransactionNo'];

    if (!this.verifySignature({ ...params }, secureHash)) {
      return { success: false, paymentStatus: PaymentStatus.FAILED, message: 'Invalid signature' };
    }

    const transaction = await this.transactions.findOne({
      where: { transactionId },
      relations: ['order'],
    });
    if (!transaction) {
      throw new ResourceNotFoundException('Transaction', 'id', transactionId);
    }

    if (vnpResponseCode === '00') {
      transaction.paymentStatus = PaymentStatus.SUCCESS;
      transaction.vnpResponseCode = vnpResponseCode;
      transaction.vnpTransactionNo = vnpTransactionNo;
      transaction.paidAt = new Date();
      await this.transactions.save(transaction);

      const order = transaction.order;
      order.paymentStatus = PaymentStatus.SUCCESS;
      await this.orders.save(order);

      return {
        success: true,
        orderId: order.id,
        transactionId,
        paymentStatus: order.paymentStatus,
        amount: transaction.amount,
        message: 'Thanh toán thành công!',
        orderNumber: order.orderNumber,
      };
    }

    transaction.paymentStatus = PaymentStatus.FAILED;
    transaction.vnpResponseCode = vnpResponseCode;
    await this.transactions.save(transaction);

    return {
      success: false,
      orderId: transaction.order.id,
      transactionId,
      paymentStatus: transaction.order.paymentStatus,
      orderNumber: transaction.order.orderNumber,
      amount: transaction.amount,
      message: `Thanh toán thất bại. Mã lỗi: ${vnpResponseCode}`,
    };
  }

  async handleIPN(params: Record<string, string>) {
    const secureHash = params['vnp_SecureHash'];
    const transactionId = params['vnp_TxnRef'];
    const vnpResponseCode = params['vnp_ResponseCode'];
    const vnpTransactionNo = params['vnp_TransactionNo'];

    if (!this.verifySignature({ ...params }, secureHash)) {
      return { success: false, message: 'Invalid signature' };
    }

    const transaction = await this.transactions.findOne({
      where: { transactionId },
      relations: ['order', 'order.user'],
    });
    if (!transaction) {
      return { success: false, message: 'Transaction not found' };
    }

    if (vnpResponseCode === '00') {
      if (transaction.paymentStatus !== PaymentStatus.SUCCESS) {
        transaction.paymentStatus = PaymentStatus.SUCCESS;
        transaction.vnpResponseCode = vnpResponseCode;
        transaction.vnpTransactionNo = vnpTransactionNo;
        transaction.paidAt = new Date();
        await this.transactions.save(transaction);

        const order = transaction.order;
        order.paymentStatus = PaymentStatus.SUCCESS;
        await this.orders.save(order);
        await this.sendOrderConfirmationEmail(order);
      }
    } else {
      transaction.paymentStatus = PaymentStatus.FAILED;
      transaction.vnpResponseCode = vnpResponseCode;
      await this.transactions.save(transaction);
    }

    return {
      success: vnpResponseCode === '00',
      transactionId,
      message: vnpResponseCode === '00' ? 'Success' : 'Failed',
    };
  }

  async getPaymentStatus(user: User, orderId: number) {
    const order = await this.findAuthorizedOrder(user, orderId);
    const transaction = await this.transactions.findOne({
      where: { order: { id: orderId } },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      transactionId: transaction?.transactionId ?? null,
      paidAt: transaction?.paidAt ?? null,
      expiresAt: transaction?.expiredAt ?? null,
      amount: transaction?.amount ?? order.totalAmount,
      success: order.paymentStatus === PaymentStatus.SUCCESS,
    };
  }

  async refund(orderId: number, amount: number, reason: string) {
    const transaction = await this.transactions.findOne({
      where: { order: { id: orderId } },
    });
    if (!transaction) {
      throw new ResourceNotFoundException('Transaction', 'orderId', orderId);
    }
    if (transaction.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Giao dịch chưa được thanh toán');
    }
    if ((transaction.refundAmount ?? 0) + amount > transaction.amount) {
      throw new BadRequestException('Số tiền hoàn vượt quá số tiền đã thanh toán');
    }

    transaction.refundAmount = (transaction.refundAmount ?? 0) + amount;
    transaction.refundedAt = new Date();
    transaction.refundReason = reason;
    transaction.paymentStatus =
      transaction.refundAmount >= transaction.amount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
    await this.transactions.save(transaction);

    return {
      success: true,
      transactionId: transaction.transactionId,
      amount,
      message: 'Hoàn tiền thành công',
    };
  }

  private verifySignature(params: Record<string, string>, secureHash: string | undefined): boolean {
    if (!secureHash || !this.isConfigured()) return false;
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];
    const queryString = this.buildQueryString(this.sortParams(params));
    return this.hmacSHA512(this.merchantKey, queryString) === secureHash;
  }

  private sortParams(params: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v != null && v !== '')
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  }

  private buildQueryString(params: Record<string, string>): string {
    // URLEncoder (Java) encodes spaces as '+' — mirror that for signature parity.
    return Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
      .join('&');
  }

  private hmacSHA512(key: string, data: string): string {
    return createHmac('sha512', key).update(data, 'utf8').digest('hex');
  }

  private generateTransactionId(): string {
    return `TXN${Date.now()}${randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`;
  }

  private async findAuthorizedOrder(user: User, orderId: number): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['user'],
    });
    if (!order) throw new ResourceNotFoundException('Order', 'id', orderId);
    const isAdmin = (user.roles || []).some((r) => r.role === Role.ADMIN);
    if (!user || (order.user.id !== user.id && !isAdmin)) {
      throw new BadRequestException('Bạn không có quyền truy cập giao dịch thanh toán này');
    }
    return order;
  }

  private async sendOrderConfirmationEmail(order: Order): Promise<void> {
    try {
      await this.email.sendOrderConfirmationEmail(order.user.email, {
        customerName: order.user.fullName,
        orderNumber: order.orderNumber,
        totalAmount: this.formatCurrency(order.totalAmount ?? 0),
        paymentMethod: 'VNPay',
      });
    } catch {
      // Email provider may be unconfigured — payment must not fail because of it.
    }
  }

  private formatCurrency(amount: number): string {
    return `${Math.round(amount).toLocaleString('en-US').replace(/,/g, '.')}đ`;
  }
}
