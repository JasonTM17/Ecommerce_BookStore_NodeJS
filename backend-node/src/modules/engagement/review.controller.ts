import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../entities/user.entity';
import { ReviewService } from './review.service';

export class ReviewRequestDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty({ message: 'ID sản phẩm không được để trống' })
  productId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Đánh giá phải từ 1 đến 5 sao' })
  @Max(5, { message: 'Đánh giá phải từ 1 đến 5 sao' })
  rating: number;

  @IsOptional() @IsString() comment?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Public()
  @Get('product/:productId')
  getProductReviews(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('page') page = '0',
    @Query('size') size = '10',
  ) {
    return this.reviewService.getProductReviews(productId, Number(page), Number(size));
  }

  @Post()
  createReview(@CurrentUser() user: User, @Body() request: ReviewRequestDto) {
    return this.reviewService.createReview(user, request);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteReview(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.reviewService.deleteReview(user, id);
  }
}
