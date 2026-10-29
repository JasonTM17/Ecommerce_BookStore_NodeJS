import {
  BadRequestException as NestBadRequest,
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../entities/enums';
import { User } from '../../entities/user.entity';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('vnpay/create')
  async createVNPayPayment(
    @CurrentUser() user: User,
    @Body() request: { orderId?: number },
    @Ip() ip: string,
  ) {
    const orderId = Number(request?.orderId);
    if (!Number.isInteger(orderId)) {
      throw new NestBadRequest('ID đơn hàng không hợp lệ');
    }
    return ApiResponse.success(await this.paymentService.createPayment(user, orderId, ip));
  }

  // VNPay-signed callbacks — the HMAC signature authenticates these, not a session.
  @Public()
  @Get('vnpay/return')
  async handleReturn(@Query() params: Record<string, string>) {
    return ApiResponse.success(await this.paymentService.handleReturn(params));
  }

  @Public()
  @Post('vnpay/ipn')
  handleIPN(@Body() params: Record<string, string>) {
    return this.paymentService.handleIPN(params);
  }

  @Get(':orderId/status')
  async getPaymentStatus(@CurrentUser() user: User, @Param('orderId', ParseIntPipe) orderId: number) {
    return ApiResponse.success(await this.paymentService.getPaymentStatus(user, orderId));
  }

  @Post(':orderId/refund')
  @Roles(Role.ADMIN)
  async refund(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() request: { amount?: number; reason?: string },
  ) {
    const amount = Number(request?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new NestBadRequest('Số tiền hoàn không hợp lệ');
    }
    return ApiResponse.success(
      await this.paymentService.refund(orderId, amount, request?.reason ?? ''),
    );
  }
}
