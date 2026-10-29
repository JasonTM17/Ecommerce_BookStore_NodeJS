import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toPageResponse, PageResponse } from '../../common/dto/page-response.dto';
import {
  ConflictException,
  ForbiddenException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { toReviewUserResponse } from '../../common/mappers';
import { OrderStatus, Role } from '../../entities/enums';
import { Order } from '../../entities/order.entity';
import { Product } from '../../entities/product.entity';
import { Review } from '../../entities/review.entity';
import { User } from '../../entities/user.entity';
import { ProductService } from '../catalog/product.service';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly productService: ProductService,
  ) {}

  async getProductReviews(productId: number, page: number, size: number): Promise<PageResponse<unknown>> {
    const [items, total] = await this.reviews.findAndCount({
      where: { product: { id: productId }, isApproved: true, isHidden: false },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    return toPageResponse(items.map((r) => this.toResponse(r)), total, page, size);
  }

  async createReview(user: User, request: { productId: number; rating: number; comment?: string; sortOrder?: number }) {
    const product = await this.products.findOne({ where: { id: request.productId } });
    if (!product) throw new ResourceNotFoundException('Product', 'id', request.productId);

    const existing = await this.reviews.findOne({
      where: { user: { id: user.id }, product: { id: request.productId } },
    });
    if (existing) {
      throw new ConflictException('Bạn đã đánh giá sản phẩm này rồi');
    }

    const isVerifiedPurchase = await this.orders
      .createQueryBuilder('o')
      .innerJoin('o.orderItems', 'item', 'item.product.id = :pid', { pid: product.id })
      .where('o.user.id = :uid', { uid: user.id })
      .andWhere('o.orderStatus = :status', { status: OrderStatus.DELIVERED })
      .getCount()
      .then((c) => c > 0);

    const review = this.reviews.create({
      user,
      product,
      rating: request.rating,
      comment: request.comment ?? null,
      isVerifiedPurchase,
      sortOrder: request.sortOrder ?? 0,
      isApproved: true,
      isHidden: false,
    });
    const saved = await this.reviews.save(review);
    await this.productService.refreshRating(product.id);
    return this.toResponse(saved);
  }

  async deleteReview(user: User, reviewId: number): Promise<void> {
    const review = await this.reviews.findOne({
      where: { id: reviewId },
      relations: ['user', 'product'],
    });
    if (!review) throw new ResourceNotFoundException('Review', 'id', reviewId);
    const isAdmin = (user.roles || []).some((r) => r.role === Role.ADMIN);
    if (review.user.id !== user.id && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá này');
    }
    const productId = review.product.id;
    await this.reviews.remove(review);
    await this.productService.refreshRating(productId);
  }

  private toResponse(review: Review) {
    return {
      id: review.id,
      user: toReviewUserResponse(review.user),
      productId: review.product.id,
      rating: review.rating,
      comment: review.comment,
      isVerifiedPurchase: review.isVerifiedPurchase,
      helpfulCount: review.helpfulCount,
      sortOrder: review.sortOrder,
      createdAt: review.createdAt,
    };
  }
}
