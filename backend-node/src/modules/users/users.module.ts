import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../../entities/address.entity';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.entity';
import { AuthModule } from '../auth/auth.module';
import { AddressService } from './address.service';
import { AddressesController } from './addresses.controller';
import { UserService } from './user.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Address, User, UserRole]),
    AuthModule,
  ],
  controllers: [UsersController, AddressesController],
  providers: [UserService, AddressService],
  exports: [UserService, AddressService],
})
export class UsersModule {}
