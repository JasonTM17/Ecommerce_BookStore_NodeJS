import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Brand } from './brand.entity';
import { Category } from './category.entity';
import { ProductImage } from './product-image.entity';

@Entity('products')
@Index('idx_product_is_active', ['isActive'])
@Index('idx_product_category', ['category'])
@Index('idx_product_brand', ['brand'])
@Index('idx_product_is_featured', ['isFeatured'])
@Index('idx_product_is_bestseller', ['isBestseller'])
@Index('idx_product_is_new', ['isNew'])
@Index('idx_product_created_at', ['createdAt'])
@Index('idx_product_sold_count', ['soldCount'])
@Index('idx_product_stock_quantity', ['stockQuantity'])
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'short_description', type: 'text', nullable: true })
  shortDescription: string | null;

  @Column({ type: 'varchar',  length: 300, nullable: true })
  author: string | null;

  @Column({ type: 'varchar',  length: 200, nullable: true })
  publisher: string | null;

  @Column({ type: 'varchar',  unique: true, length: 20, nullable: true })
  isbn: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: {
    to: (v: number) => v,
    from: (v: string) => (v === null ? v : Number(v)),
  } })
  price: number;

  @Column({ name: 'discount_price', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: {
    to: (v: number | null) => v,
    from: (v: string | null) => (v === null ? v : Number(v)),
  } })
  discountPrice: number | null;

  @Column({ name: 'discount_percent', default: 0 })
  discountPercent: number;

  @Column({ name: 'stock_quantity', default: 0 })
  stockQuantity: number;

  @Column({ type: 'text',  name: 'image_url', nullable: true })
  imageUrl: string | null;

  @OneToMany(() => ProductImage, (image) => image.product, {
    cascade: true,
    eager: true,
  })
  images: ProductImage[];

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @ManyToOne(() => Brand, (brand) => brand.products, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand | null;

  @Column({ type: 'text', nullable: true })
  specifications: string | null;

  @Column({ type: 'int',  name: 'page_count', nullable: true })
  pageCount: number | null;

  @Column({ type: 'int',  name: 'published_year', nullable: true })
  publishedYear: number | null;

  @Column({ length: 50, default: 'Vietnamese' })
  language: string;

  @Column({ type: 'int',  name: 'weight_grams', nullable: true })
  weightGrams: number | null;

  @Column({ type: 'text',  nullable: true })
  dimensions: string | null;

  @Column({ name: 'avg_rating', type: 'double precision', default: 0 })
  avgRating: number;

  @Column({ name: 'review_count', default: 0 })
  reviewCount: number;

  @Column({ name: 'sold_count', default: 0 })
  soldCount: number;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ name: 'is_bestseller', default: false })
  isBestseller: boolean;

  @Column({ name: 'is_new', default: false })
  isNew: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @VersionColumn({ default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  get currentPrice(): number {
    return this.discountPrice != null && this.discountPrice > 0
      ? this.discountPrice
      : this.price;
  }

  get inStock(): boolean {
    return (this.stockQuantity ?? 0) > 0;
  }

  /** Java @PrePersist/@PreUpdate calculateDiscountPrice() equivalent. */
  calculateDiscountPrice(): void {
    if (this.discountPercent != null && this.discountPercent > 0 && this.price != null) {
      const discount = (this.price * this.discountPercent) / 100;
      this.discountPrice = Math.round((this.price - discount) * 100) / 100;
    }
  }
}
