import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BadRequestException } from '../../common/exceptions';
import { User } from '../../entities/user.entity';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post(':productId')
  async addToWishlist(@CurrentUser() user: User, @Param('productId', ParseIntPipe) productId: number) {
    return ApiResponse.success(
      await this.wishlistService.add(user, productId),
      'Đã thêm vào danh sách yêu thích',
    );
  }

  @Get()
  async getWishlist(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    const p = page != null ? Number(page) : undefined;
    const s = size != null ? Number(size) : undefined;
    return ApiResponse.success(await this.wishlistService.getWishlist(user, p, s));
  }

  @Get('count')
  async getWishlistCount(@CurrentUser() user: User) {
    return ApiResponse.success({ count: await this.wishlistService.count(user) });
  }

  @Get(':productId')
  async checkInWishlist(@CurrentUser() user: User, @Param('productId', ParseIntPipe) productId: number) {
    return ApiResponse.success({ isInWishlist: await this.wishlistService.isInWishlist(user, productId) });
  }

  @Delete(':productId')
  async removeFromWishlist(@CurrentUser() user: User, @Param('productId', ParseIntPipe) productId: number) {
    await this.wishlistService.remove(user, productId);
    return ApiResponse.success(null, 'Đã xóa khỏi danh sách yêu thích');
  }

  @Patch(':productId/notes')
  async updateNotes(
    @CurrentUser() user: User,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: { notes?: string },
  ) {
    if (body?.notes == null) throw new BadRequestException('Ghi chú không được để trống');
    await this.wishlistService.updateNotes(user, productId, body.notes);
    return ApiResponse.success(null, 'Đã cập nhật ghi chú');
  }

  @Patch(':productId/priority')
  async updatePriority(
    @CurrentUser() user: User,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: { priority?: number },
  ) {
    if (body?.priority == null || !Number.isInteger(Number(body.priority))) {
      throw new BadRequestException('Độ ưu tiên không hợp lệ');
    }
    await this.wishlistService.updatePriority(user, productId, Number(body.priority));
    return ApiResponse.success(null, 'Đã cập nhật độ ưu tiên');
  }
}
