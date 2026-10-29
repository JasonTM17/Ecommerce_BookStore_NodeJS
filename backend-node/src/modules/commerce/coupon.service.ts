import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { toSpringPage, SpringPage } from '../../common/dto/api-response.dto';
import {
  BadRequestException,
  ConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { CouponUsage } from '../../entities/coupon-usage.entity';
import { Coupon } from '../../entities/coupon.entity';
import { CouponType } from '../../entities/enums';
import { User } from '../../entities/user.entity';

export function toCouponResponse(coupon: Coupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    discountValue: coupon.discountValue,
    minOrderAmount: coupon.minOrderAmount,
    maxDiscount: coupon.maxDiscount,
    startDate: coupon.startDate,
    endDate: coupon.endDate,
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    perUserLimit: coupon.perUserLimit,
    isActive: coupon.isActive,
    isPublic: coupon.isPublic,
    isValid: coupon.isValid(),
    isExpired: coupon.isExpired(),
    discountDisplay:
      coupon.type === CouponType.PERCENTAGE
        ? `Giảm ${coupon.discountValue}%`
        : coupon.type === CouponType.FREE_SHIPPING
          ? 'Miễn phí vận chuyển'
          : `Giảm ${coupon.discountValue}đ`,
    sortOrder: coupon.sortOrder,
    createdAt: coupon.createdAt,
  };
}

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
    @InjectRepository(CouponUsage) private readonly usages: Repository<CouponUsage>,
  ) {}

  async getAvailable() {
    const all = await this.coupons.find({
      where: { isActive: true, isPublic: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
    return all.filter((c) => c.isValid()).map(toCouponResponse);
  }

  async getAll(page: number, size: number): Promise<SpringPage<ReturnType<typeof toCouponResponse>>> {
    const [items, total] = await this.coupons.findAndCount({
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return toSpringPage(items.map(toCouponResponse), total, page, size);
  }

  async search(keyword: string, page: number, size: number) {
    const [items, total] = await this.coupons.findAndCount({
      where: [{ code: ILike(`%${keyword}%`) }, { description: ILike(`%${keyword}%`) }],
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return toSpringPage(items.map(toCouponResponse), total, page, size);
  }

  async getById(id: number) {
    const coupon = await this.coupons.findOne({ where: { id } });
    if (!coupon) throw new ResourceNotFoundException('Coupon', 'id', id);
    return toCouponResponse(coupon);
  }

  async create(request: any) {
    if (await this.coupons.findOne({ where: { code: request.code } })) {
      throw new ConflictException('Mã giảm giá đã tồn tại');
    }
    const coupon = this.coupons.create(this.fromRequest(request));
    return toCouponResponse(await this.coupons.save(coupon));
  }

  async update(id: number, request: any) {
    const coupon = await this.coupons.findOne({ where: { id } });
    if (!coupon) throw new ResourceNotFoundException('Coupon', 'id', id);
    if (request.code != null && request.code !== coupon.code) {
      if (await this.coupons.findOne({ where: { code: request.code } })) {
        throw new ConflictException('Mã giảm giá đã tồn tại');
      }
    }
    Object.assign(coupon, this.fromRequest(request, coupon));
    return toCouponResponse(await this.coupons.save(coupon));
  }

  async remove(id: number): Promise<void> {
    const coupon = await this.coupons.findOne({ where: { id } });
    if (!coupon) throw new ResourceNotFoundException('Coupon', 'id', id);
    await this.coupons.remove(coupon);
  }

  async validateForUser(user: User | null, code: string, orderTotal?: number) {
    const coupon = await this.coupons.findOne({ where: { code } });
    if (!coupon) throw new ResourceNotFoundException('Coupon', 'code', code);
    this.assertUsable(coupon, orderTotal);
    if (user && coupon.perUserLimit > 0) {
      const usedByUser = await this.usages.count({
        where: { coupon: { id: coupon.id }, user: { id: user.id } },
      });
      if (usedByUser >= coupon.perUserLimit) {
        throw new BadRequestException('Bạn đã sử dụng hết lượt áp dụng mã này');
      }
    }
    return toCouponResponse(coupon);
  }

  /** Computes the discount amount for an order total. Throws when invalid. */
  async applyCoupon(
    user: User,
    code: string,
    orderTotal: number,
  ): Promise<{ coupon: Coupon; discount: number }> {
    const coupon = await this.coupons.findOne({ where: { code } });
    if (!coupon) throw new ResourceNotFoundException('Coupon', 'code', code);
    this.assertUsable(coupon, orderTotal);
    if (coupon.perUserLimit > 0) {
      const usedByUser = await this.usages.count({
        where: { coupon: { id: coupon.id }, user: { id: user.id } },
      });
      if (usedByUser >= coupon.perUserLimit) {
        throw new BadRequestException('Bạn đã sử dụng hết lượt áp dụng mã này');
      }
    }
    return { coupon, discount: this.computeDiscount(coupon, orderTotal) };
  }

  computeDiscount(coupon: Coupon, orderTotal: number): number {
    let discount = 0;
    if (coupon.type === CouponType.PERCENTAGE) {
      discount = (orderTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
    } else if (coupon.type === CouponType.FIXED_AMOUNT) {
      discount = Math.min(coupon.discountValue, orderTotal);
    }
    return Math.round(discount * 100) / 100;
  }

  private assertUsable(coupon: Coupon, orderTotal?: number): void {
    if (!coupon.isActive) throw new BadRequestException('Mã giảm giá không còn hiệu lực');
    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      throw new BadRequestException('Mã giảm giá chưa bắt đầu');
    }
    if (coupon.endDate && now > coupon.endDate) {
      throw new BadRequestException('Mã giảm giá đã hết hạn');
    }
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng');
    }
    if (orderTotal != null && coupon.minOrderAmount > 0 && orderTotal < coupon.minOrderAmount) {
      throw new BadRequestException(
        `Đơn hàng tối thiểu ${coupon.minOrderAmount}đ để áp dụng mã này`,
      );
    }
  }

  private fromRequest(request: any, existing?: Coupon): Partial<Coupon> {
    const pick = (v: any, fallback: any) => (v !== undefined ? v : fallback);
    return {
      code: pick(request.code, existing?.code),
      description: pick(request.description, existing?.description ?? null),
      type: pick(request.type, existing?.type ?? CouponType.FIXED_AMOUNT),
      discountValue: pick(request.discountValue, existing?.discountValue ?? 0),
      minOrderAmount: pick(request.minOrderAmount, existing?.minOrderAmount ?? 0),
      maxDiscount: pick(request.maxDiscount, existing?.maxDiscount ?? 0),
      startDate: request.startDate !== undefined
        ? request.startDate ? new Date(request.startDate) : null
        : existing?.startDate ?? null,
      endDate: request.endDate !== undefined
        ? request.endDate ? new Date(request.endDate) : null
        : existing?.endDate ?? null,
      usageLimit: pick(request.usageLimit, existing?.usageLimit ?? 0),
      perUserLimit: pick(request.perUserLimit, existing?.perUserLimit ?? 1),
      isActive: pick(request.isActive, existing?.isActive ?? true),
      isPublic: pick(request.isPublic, existing?.isPublic ?? true),
      sortOrder: pick(request.sortOrder, existing?.sortOrder ?? 0),
      applicableCategories: pick(request.applicableCategories, existing?.applicableCategories ?? null),
      applicableProducts: pick(request.applicableProducts, existing?.applicableProducts ?? null),
    };
  }
}
