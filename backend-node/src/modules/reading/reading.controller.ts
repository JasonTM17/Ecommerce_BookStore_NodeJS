import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BadRequestException } from '../../common/exceptions';
import { User } from '../../entities/user.entity';
import { ReadingService } from './reading.service';

@Controller('reading')
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  // Java parity route
  @Post('start/:productId')
  async startReading(@CurrentUser() user: User, @Param('productId', ParseIntPipe) productId: number) {
    return ApiResponse.success(await this.readingService.startReading(user, productId), 'Đã bắt đầu đọc sách');
  }

  // Frontend route: POST /reading/progress { productId }
  @Post('progress')
  async startReadingBody(@CurrentUser() user: User, @Body() body: { productId?: number }) {
    const productId = Number(body?.productId);
    if (!Number.isInteger(productId)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ');
    }
    return ApiResponse.success(await this.readingService.startReading(user, productId), 'Đã bắt đầu đọc sách');
  }

  @Get('progress')
  async getProgress(@CurrentUser() user: User) {
    return ApiResponse.success(await this.readingService.getUserProgress(user));
  }

  @Put('progress/:id')
  async updateProgress(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentPage?: number; status?: string },
  ) {
    const currentPage = Number(body?.currentPage ?? 0);
    return ApiResponse.success(await this.readingService.updateProgress(user, id, currentPage, body?.status));
  }

  // Java parity route: POST /reading/finish/:id
  @Post('finish/:id')
  async finishBook(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: { rating?: number; review?: string },
  ) {
    return ApiResponse.success(
      await this.readingService.finishBook(user, id, body?.rating, body?.review),
      'Đã hoàn thành sách',
    );
  }

  // Frontend route: POST /reading/progress/:id/finish
  @Post('progress/:id/finish')
  async finishBookAlt(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: { rating?: number; review?: string },
  ) {
    return ApiResponse.success(
      await this.readingService.finishBook(user, id, body?.rating, body?.review),
      'Đã hoàn thành sách',
    );
  }

  @Get('stats')
  async getStats(@CurrentUser() user: User) {
    return ApiResponse.success(await this.readingService.getStats(user));
  }

  // Frontend-only endpoints
  @Get('streak')
  async getStreak(@CurrentUser() user: User) {
    return ApiResponse.success(await this.readingService.getStreak(user));
  }

  @Get('challenges')
  async getChallenges(@CurrentUser() user: User) {
    return ApiResponse.success(await this.readingService.getChallenges(user));
  }

  @Post('challenges')
  async createChallenge(
    @CurrentUser() user: User,
    @Body() body: { year?: number; targetBooks?: number },
  ) {
    return ApiResponse.success(
      await this.readingService.createChallenge(user, Number(body?.year), Number(body?.targetBooks)),
      'Đã tạo thử thách đọc sách',
    );
  }
}
