import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { InventoryAction, Role } from '../../entities/enums';
import { User } from '../../entities/user.entity';
import { InventoryService } from './inventory.service';

export class InventoryAdjustRequestDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty({ message: 'ID sản phẩm không được để trống' })
  productId: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty({ message: 'Số lượng thay đổi không được để trống' })
  quantityChange: number;

  @IsEnum(InventoryAction, { message: 'Hành động không được để trống hoặc không hợp lệ' })
  action: InventoryAction;

  @IsOptional() @IsString() reason?: string;
}

@Controller('admin/inventory')
@Roles(Role.ADMIN)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('adjust')
  async adjustInventory(@CurrentUser() user: User, @Body() request: InventoryAdjustRequestDto) {
    return ApiResponse.success(
      await this.inventoryService.adjust(user, request),
      'Đã điều chỉnh tồn kho',
    );
  }

  @Get('low-stock')
  async getLowStockProducts(@Query('threshold') threshold = '10') {
    return ApiResponse.success(await this.inventoryService.getLowStock(Number(threshold)));
  }

  @Get('history/:productId')
  async getInventoryHistory(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('page') page = '0',
    @Query('size') size = '20',
  ) {
    return ApiResponse.success(
      await this.inventoryService.getHistory(productId, Number(page), Number(size)),
    );
  }

  @Get('logs')
  async getAllLogs(@Query('page') page = '0', @Query('size') size = '20') {
    return ApiResponse.success(await this.inventoryService.getLogs(Number(page), Number(size)));
  }
}
