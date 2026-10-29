import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';
import { ProductQuery } from './dto/catalog.dto';
import { ProductService } from './product.service';

@Public()
@Controller()
export class CatalogController {
  constructor(
    private readonly products: ProductService,
    private readonly categories: CategoryService,
    private readonly brands: BrandService,
  ) {}

  @Get('products')
  getProducts(@Query() query: ProductQuery) {
    return this.products.getProducts(query);
  }

  @Get('products/featured')
  getFeatured() {
    return this.products.getFeatured();
  }

  @Get('products/bestsellers')
  getBestsellers() {
    return this.products.getBestsellers();
  }

  @Get('products/new')
  getNew() {
    return this.products.getNew();
  }

  @Get('products/low-stock')
  getLowStock(@Query('threshold') threshold?: string) {
    return this.products.getLowStock(threshold ? Number(threshold) : 10);
  }

  @Get('products/category/:categoryId')
  getByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Query('page') page = '0',
    @Query('size') size = '12',
  ) {
    return this.products.getByCategory(categoryId, Number(page), Number(size));
  }

  @Get('products/:id/related')
  getRelated(
    @Param('id', ParseIntPipe) id: number,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.products.getRelated(id, categoryId ? Number(categoryId) : undefined);
  }

  @Get('products/:id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.products.getById(id);
  }

  @Get('categories')
  getAllCategories() {
    return this.categories.getAll();
  }

  @Get('categories/root')
  getRootCategories() {
    return this.categories.getRoot();
  }

  @Get('categories/:id/subcategories')
  getSubcategories(@Param('id', ParseIntPipe) id: number) {
    return this.categories.getSubcategories(id);
  }

  @Get('categories/:id')
  getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categories.getById(id);
  }

  @Get('brands')
  getAllBrands() {
    return this.brands.getAll();
  }

  @Get('brands/:id')
  getBrand(@Param('id', ParseIntPipe) id: number) {
    return this.brands.getById(id);
  }
}
