import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { AddressService } from './address.service';
import { AddressRequest } from './dto/user.dto';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  getUserAddresses(@CurrentUser() user: User) {
    return this.addressService.getUserAddresses(user);
  }

  @Post()
  createAddress(@CurrentUser() user: User, @Body() request: AddressRequest) {
    return this.addressService.createAddress(user, request);
  }

  @Put(':id')
  updateAddress(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() request: AddressRequest,
  ) {
    return this.addressService.updateAddress(user, id, request);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteAddress(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.addressService.deleteAddress(user, id);
  }
}
