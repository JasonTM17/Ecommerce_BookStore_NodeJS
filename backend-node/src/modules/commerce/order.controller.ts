import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { OrderService } from './order.service';

export class OrderItemRequestDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty({ message: 'ID sản phẩm không được để trống' })
  productId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Số lượng không hợp lệ' })
  quantity: number;
}

export class OrderRequestDto {
  @ArrayNotEmpty({ message: 'Danh sách sản phẩm không được để trống' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequestDto)
  items: OrderItemRequestDto[];

  @IsNotEmpty({ message: 'Địa chỉ giao hàng không được để trống' })
  shippingAddress: string;

  @IsNotEmpty({ message: 'Số điện thoại giao hàng không được để trống' })
  shippingPhone: string;

  @IsNotEmpty({ message: 'Tên người nhận không được để trống' })
  shippingReceiverName: string;

  @IsOptional() @IsString() shippingMethod?: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() notes?: string;
}

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  createOrder(@CurrentUser() user: User, @Body() request: OrderRequestDto) {
    return this.orderService.createOrder(user, request);
  }

  @Get()
  getUserOrders(
    @CurrentUser() user: User,
    @Query('page') page = '0',
    @Query('size') size = '10',
  ) {
    return this.orderService.getUserOrders(user, Number(page), Number(size));
  }

  @Get(':id')
  getOrderById(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.orderService.getOrderById(user, id);
  }
}
