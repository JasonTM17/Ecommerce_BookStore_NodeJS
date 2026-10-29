import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProductQuery {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
  @IsOptional() @Type(() => Number) @IsInt() brandId?: number;
  @IsOptional() @Type(() => Number) @IsNumber() minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxPrice?: number;
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inStock?: boolean;
  @IsOptional() @IsString() sortBy?: string = 'createdAt';
  @IsOptional() @IsString() direction?: string = 'DESC';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) page?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) size?: number = 12;
}

export class ProductRequest {
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  @MaxLength(500)
  name: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @MaxLength(500) shortDescription?: string;
  @IsOptional() @MaxLength(300) author?: string;
  @IsOptional() @MaxLength(200) publisher?: string;
  @IsOptional() @MaxLength(20) isbn?: string;

  @IsNotEmpty({ message: 'Giá không được để trống' })
  @IsNumber({}, { message: 'Giá phải lớn hơn 0' })
  @Min(0.01, { message: 'Giá phải lớn hơn 0' })
  price: number;

  @IsOptional() @IsNumber() @Min(0) discountPrice?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) discountPercent?: number;
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];

  @IsNotEmpty({ message: 'Danh mục không được để trống' })
  @Type(() => Number)
  @IsInt()
  categoryId: number;

  @IsOptional() @Type(() => Number) @IsInt() brandId?: number;
  @IsOptional() @IsString() specifications?: string;
  @IsOptional() @IsInt() pageCount?: number;
  @IsOptional() @IsInt() publishedYear?: number;
  @IsOptional() @MaxLength(50) language?: string;
  @IsOptional() @IsInt() weightGrams?: number;
  @IsOptional() @IsString() dimensions?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isBestseller?: boolean;
  @IsOptional() @IsBoolean() isNew?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class CategoryRequest {
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  @MaxLength(200)
  name: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() iconUrl?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @Type(() => Number) @IsInt() parentId?: number;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class BrandRequest {
  @IsNotEmpty({ message: 'Tên thương hiệu không được để trống' })
  @MaxLength(200)
  name: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() websiteUrl?: string;
}
