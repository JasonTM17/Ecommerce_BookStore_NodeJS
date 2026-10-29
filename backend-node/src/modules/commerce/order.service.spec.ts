import { OrderService } from './order.service';
import { BadRequestException, ResourceNotFoundException } from '../../common/exceptions';
import { OrderStatus, PaymentStatus, Role } from '../../entities/enums';

const ownerUser = { id: 7, email: 'owner@test.dev', roles: [{ role: Role.CUSTOMER }] } as any;
const otherUser = { id: 8, email: 'other@test.dev', roles: [{ role: Role.CUSTOMER }] } as any;
const adminUser = { id: 9, email: 'admin@test.dev', roles: [{ role: Role.ADMIN }] } as any;

const order = {
  id: 42,
  orderNumber: 'ORD123',
  user: ownerUser,
  orderStatus: OrderStatus.PENDING,
  paymentStatus: PaymentStatus.PENDING,
  orderItems: [],
  shippingFee: 25000,
  subtotal: 100000,
  taxAmount: 10000,
  discountAmount: 0,
  totalAmount: 135000,
  sortOrder: 0,
} as any;

function buildService(orderResult: any) {
  const orders = {
    findOne: jest.fn(async () => orderResult),
    findAndCount: jest.fn(async () => [[], 0]),
    count: jest.fn(async () => 0),
    manager: {},
  };
  const dataSource = { transaction: jest.fn(async (fn: any) => fn({})) };
  const pricing = { resolveAll: jest.fn(async () => new Map()) };
  const service = new OrderService(dataSource as any, orders as any, pricing as any);
  return { service, orders };
}

describe('OrderService ownership', () => {
  it('lets the owner read their order', async () => {
    const { service } = buildService(order);
    const result = await service.getOrderById(ownerUser, 42);
    expect(result).toMatchObject({ id: 42, orderNumber: 'ORD123' });
  });

  it('rejects another user reading the order', async () => {
    const { service } = buildService(order);
    await expect(service.getOrderById(otherUser, 42)).rejects.toThrow(
      'Bạn không có quyền xem đơn hàng này',
    );
  });

  it('lets an admin read any order', async () => {
    const { service } = buildService(order);
    const result = await service.getOrderById(adminUser, 42);
    expect(result).toMatchObject({ id: 42 });
  });

  it('throws NotFound for a missing order', async () => {
    const { service } = buildService(null);
    await expect(service.getOrderById(ownerUser, 999)).rejects.toThrow(ResourceNotFoundException);
  });
});
