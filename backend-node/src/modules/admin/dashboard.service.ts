import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus } from '../../entities/enums';
import { User } from '../../entities/user.entity';
import { OrderService } from '../commerce/order.service';
import { ProductService } from '../catalog/product.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly orders: OrderService,
    private readonly products: ProductService,
  ) {}

  async getStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      totalUsers, totalProducts, totalOrders,
      pendingOrders, completedOrders, totalRevenue,
      lowStockProducts, newOrdersThisMonth, revenueThisMonth,
      monthlyRevenueTrend,
    ] = await Promise.all([
      this.users.count(),
      this.products.countActive(),
      this.orders.countAll(),
      this.orders.countByStatus(OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING),
      this.orders.countByStatus(OrderStatus.DELIVERED),
      this.orders.sumDelivered(),
      this.products.countLowStock(10),
      this.orders.countCreatedSince(monthStart),
      this.orders.sumDeliveredBetween(monthStart, nextMonth),
      this.buildMonthlyTrend(now),
    ]);

    return {
      totalUsers,
      totalProducts,
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue,
      lowStockProducts,
      newOrdersThisMonth,
      revenueThisMonth,
      monthlyRevenueTrend,
    };
  }

  private async buildMonthlyTrend(now: Date): Promise<Record<string, number>> {
    const trend: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      trend[key] = await this.orders.sumDeliveredBetween(start, end);
    }
    return trend;
  }
}
