import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { CartService } from './cart.service';

export class CartItemRequest {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty({ message: 'Sản phẩm không được để trống' })
  productId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  quantity: number;
}

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: User) {
    return this.cartService.getCartResponse(user);
  }

  @Post('items')
  addToCart(@CurrentUser() user: User, @Body() request: CartItemRequest) {
    return this.cartService.addItem(user, request.productId, request.quantity);
  }

  @Put('items/:itemId')
  updateCartItem(
    @CurrentUser() user: User,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('quantity') quantity: string,
  ) {
    return this.cartService.updateItem(user, itemId, Number(quantity));
  }

  @Delete('items/:itemId')
  removeFromCart(@CurrentUser() user: User, @Param('itemId', ParseIntPipe) itemId: number) {
    return this.cartService.removeItem(user, itemId);
  }

  @Delete()
  @HttpCode(204)
  clearCart(@CurrentUser() user: User) {
    return this.cartService.clearCart(user);
  }
}
