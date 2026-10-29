import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BadRequestException } from '../../common/exceptions';
import { toUserResponse } from '../../common/mappers';
import { User } from '../../entities/user.entity';
import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';
import { UserUpdateRequest } from './dto/user.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  getCurrentUser(@CurrentUser() user: User) {
    return toUserResponse(user, true);
  }

  @Put('me')
  updateProfile(@CurrentUser() user: User, @Body() request: UserUpdateRequest) {
    return this.userService.updateProfile(user, request);
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: User,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    const current = body?.currentPassword;
    const next = body?.newPassword;
    if (!current || !next) {
      throw new BadRequestException('Mật khẩu hiện tại và mật khẩu mới không được để trống');
    }
    if (next.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
    }
    await this.authService.changePassword(user, current, next);
  }
}
