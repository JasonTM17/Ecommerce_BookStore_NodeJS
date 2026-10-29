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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  BadRequestException,
  ForbiddenException,
} from '../../common/exceptions';
import { OrderStatus, PaymentStatus, Role } from '../../entities/enums';
import { User } from '../../entities/user.entity';
import { BrandService } from '../catalog/brand.service';
import { CategoryService } from '../catalog/category.service';
import { BrandRequest, CategoryRequest, ProductRequest } from '../catalog/dto/catalog.dto';
import { ProductService } from '../catalog/product.service';
import { OrderService } from '../commerce/order.service';
import { UserService } from '../users/user.service';
import { DashboardService } from './dashboard.service';

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly categoryService: CategoryService,
    private readonly brandService: BrandService,
    private readonly orderService: OrderService,
  ) {}

  @Get('dashboard')
  getDashboardStats() {
    return this.dashboard.getStats();
  }

  @Get('users')
  getAllUsers(@Query('page') page = '0', @Query('size') size = '10') {
    return this.userService.getAllUsers(Number(page), Number(size));
  }

  @Get('users/search')
  searchUsers(
    @Query('keyword') keyword: string,
    @Query('page') page = '0',
    @Query('size') size = '10',
  ) {
    return this.userService.searchUsers(keyword ?? '', Number(page), Number(size));
  }

  @Put('users/:id/role')
  updateUserRole(
    @CurrentUser() admin: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() roles: Role[],
  ) {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new BadRequestException('Vai trò không hợp lệ');
    }
    if (id === admin.id && !roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Không thể tự gỡ quyền ADMIN của chính mình');
    }
    return this.userService.updateUserRole(id, roles);
  }

  @Put('users/:id/activate')
  @HttpCode(200)
  activateUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.activateUser(id);
  }

  @Put('users/:id/deactivate')
  @HttpCode(200)
  deactivateUser(@CurrentUser() admin: User, @Param('id', ParseIntPipe) id: number) {
    if (id === admin.id) {
      throw new ForbiddenException('Không thể tự vô hiệu hóa tài khoản của chính mình');
    }
    return this.userService.deactivateUser(id);
  }

  @Post('products')
  createProduct(@Body() request: ProductRequest) {
    return this.productService.create(request);
  }

  @Put('products/:id')
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() request: ProductRequest) {
    return this.productService.update(id, request);
  }

  @Delete('products/:id')
  @HttpCode(204)
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productService.softDelete(id);
  }

  @Post('categories')
  createCategory(@Body() request: CategoryRequest) {
    return this.categoryService.create(request);
  }

  @Put('categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() request: CategoryRequest) {
    return this.categoryService.update(id, request);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.softDelete(id);
  }

  @Post('brands')
  createBrand(@Body() request: BrandRequest) {
    return this.brandService.create(request);
  }

  @Put('brands/:id')
  updateBrand(@Param('id', ParseIntPipe) id: number, @Body() request: BrandRequest) {
    return this.brandService.update(id, request);
  }

  @Delete('brands/:id')
  @HttpCode(204)
  deleteBrand(@Param('id', ParseIntPipe) id: number) {
    return this.brandService.softDelete(id);
  }

  @Get('orders')
  getAllOrders(
    @Query('page') page = '0',
    @Query('size') size = '10',
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.getAllOrders(Number(page), Number(size), status);
  }

  @Get('orders/:id')
  getOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.getAdminOrderById(id);
  }

  @Put('orders/:id/status')
  updateOrderStatus(@Param('id', ParseIntPipe) id: number, @Query('status') status: OrderStatus) {
    if (!Object.values(OrderStatus).includes(status)) {
      throw new BadRequestException('Trạng thái đơn hàng không hợp lệ');
    }
    return this.orderService.updateOrderStatus(id, status);
  }

  @Put('orders/:id/payment')
  updatePaymentStatus(@Param('id', ParseIntPipe) id: number, @Query('status') status: PaymentStatus) {
    if (!Object.values(PaymentStatus).includes(status)) {
      throw new BadRequestException('Trạng thái thanh toán không hợp lệ');
    }
    return this.orderService.updatePaymentStatus(id, status);
  }
}
