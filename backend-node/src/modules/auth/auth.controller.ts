import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import {
  ForgotPasswordRequest,
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from './dto/auth.dto';

/**
 * Java returns bare AuthResponse for register/login/refresh (no ApiResponse
 * wrapper) and ApiResponse<Void> for the password-reset endpoints.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() request: RegisterRequest) {
    return this.authService.register(request);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() request: LoginRequest) {
    return this.authService.login(request);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refreshToken(@Body() request: RefreshTokenRequest) {
    return this.authService.refreshToken(request);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Body() request?: RefreshTokenRequest) {
    await this.authService.logout(request?.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() request: ForgotPasswordRequest) {
    await this.passwordResetService.forgotPassword(request);
    return ApiResponse.success(
      null,
      'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi',
    );
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() request: ResetPasswordRequest) {
    await this.passwordResetService.resetPassword(request);
    return ApiResponse.success(null, 'Mật khẩu đã được đặt lại thành công');
  }
}
