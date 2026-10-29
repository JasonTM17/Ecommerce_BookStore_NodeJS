import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../entities/product.entity';
import { IsbnController } from './isbn.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [IsbnController],
})
export class IsbnModule {}
