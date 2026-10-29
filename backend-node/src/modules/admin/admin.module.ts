import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { CommerceModule } from '../commerce/commerce.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    CatalogModule,
    CommerceModule,
    UsersModule,
  ],
  controllers: [AdminController],
  providers: [DashboardService],
})
export class AdminModule {}
