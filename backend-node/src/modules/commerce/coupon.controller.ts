import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../entities/enums';
import { User } from '../../entities/user.entity';
import { CouponService } from './coupon.service';

export class CouponRequestDto {
  @IsNotEmpty({ message: 'Mã coupon không được để trống' })
  @MinLength(3, { message: 'Mã coupon phải từ 3 đến 50 ký tự' })
  @MaxLength(50, { message: 'Mã coupon phải từ 3 đến 50 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Mã coupon chỉ chứa chữ hoa, số, gạch dưới và gạch ngang' })
  code: string;

  @IsOptional() @MaxLength(255) description?: string;
  @IsNotEmpty({ message: 'Loại coupon không được để trống' }) type: string;
  @IsNotEmpty({ message: 'Giá trị giảm giá không được để trống' })
  @IsNumber() @Min(0.01) discountValue: number;
  @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;
  @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) usageLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perUserLimit?: number;
  @IsOptional() isPublic?: boolean;
  @IsOptional() @IsString() applicableCategories?: string;
  @IsOptional() @IsString() applicableProducts?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class CouponValidationRequestDto {
  @IsNotEmpty({ message: 'Mã coupon không được để trống' })
  code: string;

  @IsOptional() @IsNumber() orderTotal?: number;
}

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  @Roles(Role.ADMIN)
  async createCoupon(@Body() request: CouponRequestDto) {
    return ApiResponse.success(await this.couponService.create(request), 'Đã tạo mã giảm giá');
  }

  @Get()
  @Roles(Role.ADMIN)
  async getAllCoupons(@Query('page') page = '0', @Query('size') size = '20') {
    return ApiResponse.success(await this.couponService.getAll(Number(page), Number(size)));
  }

  @Get('available')
  async getAvailableCoupons() {
    return ApiResponse.success(await this.couponService.getAvailable());
  }

  @Get('search')
  @Roles(Role.ADMIN)
  async searchCoupons(
    @Query('keyword') keyword: string,
    @Query('page') page = '0',
    @Query('size') size = '20',
  ) {
    return ApiResponse.success(await this.couponService.search(keyword, Number(page), Number(size)));
  }

  @Post('validate')
  async validateCoupon(@CurrentUser() user: User, @Body() request: CouponValidationRequestDto) {
    return ApiResponse.success(
      await this.couponService.validateForUser(user, request.code, request.orderTotal),
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async getCouponById(@Param('id', ParseIntPipe) id: number) {
    return ApiResponse.success(await this.couponService.getById(id));
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  async updateCoupon(@Param('id', ParseIntPipe) id: number, @Body() request: CouponRequestDto) {
    return ApiResponse.success(await this.couponService.update(id, request), 'Đã cập nhật mã giảm giá');
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteCoupon(@Param('id', ParseIntPipe) id: number) {
    await this.couponService.remove(id);
    return ApiResponse.success(null, 'Đã xóa mã giảm giá');
  }
}
