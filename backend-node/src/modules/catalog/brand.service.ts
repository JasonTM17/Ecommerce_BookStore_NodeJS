import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { Brand } from '../../entities/brand.entity';
import { Product } from '../../entities/product.entity';
import { toBrandResponse } from './catalog.mappers';
import { BrandRequest } from './dto/catalog.dto';

@Injectable()
export class BrandService {
  constructor(
    @InjectRepository(Brand) private readonly brands: Repository<Brand>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async getAll() {
    const brands = await this.brands.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    return Promise.all(brands.map((b) => this.toResponseWithCount(b)));
  }

  async getById(id: number) {
    const brand = await this.brands.findOne({ where: { id } });
    if (!brand) throw new ResourceNotFoundException('Brand', 'id', id);
    return this.toResponseWithCount(brand);
  }

  async create(request: BrandRequest) {
    if (await this.brands.findOne({ where: { name: request.name } })) {
      throw new ConflictException('Thương hiệu đã tồn tại');
    }
    const brand = this.brands.create({
      name: request.name,
      description: request.description ?? null,
      logoUrl: request.logoUrl ?? null,
      websiteUrl: request.websiteUrl ?? null,
      isActive: true,
    });
    return this.toResponseWithCount(await this.brands.save(brand));
  }

  async update(id: number, request: BrandRequest) {
    const brand = await this.brands.findOne({ where: { id } });
    if (!brand) throw new ResourceNotFoundException('Brand', 'id', id);
    if (request.name != null && request.name !== brand.name) {
      if (await this.brands.findOne({ where: { name: request.name } })) {
        throw new ConflictException('Thương hiệu đã tồn tại');
      }
      brand.name = request.name;
    }
    if (request.description != null) brand.description = request.description;
    if (request.logoUrl != null) brand.logoUrl = request.logoUrl;
    if (request.websiteUrl != null) brand.websiteUrl = request.websiteUrl;
    return this.toResponseWithCount(await this.brands.save(brand));
  }

  async softDelete(id: number): Promise<void> {
    const brand = await this.brands.findOne({ where: { id } });
    if (!brand) throw new ResourceNotFoundException('Brand', 'id', id);
    brand.isActive = false;
    await this.brands.save(brand);
  }

  private async toResponseWithCount(brand: Brand) {
    const productCount = await this.products.count({
      where: { isActive: true, brand: { id: brand.id } },
    });
    return toBrandResponse(brand, productCount);
  }
}
