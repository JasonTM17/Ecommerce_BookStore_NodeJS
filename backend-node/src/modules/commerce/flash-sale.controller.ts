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
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../entities/enums';
import { FlashSaleService } from './flash-sale.service';

export class FlashSaleRequestDto {
  @Type(() => Number) @IsInt() @IsNotEmpty({ message: 'ID sản phẩm không được để trống' })
  productId: number;
  @IsNotEmpty({ message: 'Giá gốc không được để trống' }) @IsNumber() @Min(0.01)
  originalPrice: number;
  @IsNotEmpty({ message: 'Giá sale không được để trống' }) @IsNumber() @Min(0.01)
  salePrice: number;
  @IsNotEmpty({ message: 'Thời gian bắt đầu không được để trống' }) @IsDateString()
  startTime: string;
  @IsNotEmpty({ message: 'Thời gian kết thúc không được để trống' }) @IsDateString()
  endTime: string;
  @Type(() => Number) @IsInt() @Min(1, { message: 'Số lượng phải > 0' })
  stockLimit: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxPerUser?: number;
  @IsOptional() isActive?: boolean;
}

@Controller()
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Public()
  @Get('flash-sales/active')
  async getActiveFlashSales() {
    return ApiResponse.success(await this.flashSaleService.getActive());
  }

  @Public()
  @Get('flash-sales/upcoming')
  async getUpcomingFlashSales() {
    return ApiResponse.success(await this.flashSaleService.getUpcoming());
  }

  @Public()
  @Get('flash-sales/:id')
  async getFlashSale(@Param('id', ParseIntPipe) id: number) {
    return ApiResponse.success(await this.flashSaleService.getById(id));
  }

  @Get('admin/flash-sales')
  @Roles(Role.ADMIN)
  async getAllFlashSales(@Query('page') page = '0', @Query('size') size = '20') {
    return ApiResponse.success(await this.flashSaleService.getAll(Number(page), Number(size)));
  }

  @Post('admin/flash-sales')
  @Roles(Role.ADMIN)
  async createFlashSale(@Body() request: FlashSaleRequestDto) {
    return ApiResponse.success(await this.flashSaleService.create(request), 'Đã tạo flash sale');
  }

  @Put('admin/flash-sales/:id')
  @Roles(Role.ADMIN)
  async updateFlashSale(@Param('id', ParseIntPipe) id: number, @Body() request: FlashSaleRequestDto) {
    return ApiResponse.success(await this.flashSaleService.update(id, request), 'Đã cập nhật flash sale');
  }

  @Delete('admin/flash-sales/:id')
  @Roles(Role.ADMIN)
  async deleteFlashSale(@Param('id', ParseIntPipe) id: number) {
    await this.flashSaleService.remove(id);
    return ApiResponse.success(null, 'Đã xóa flash sale');
  }
}
