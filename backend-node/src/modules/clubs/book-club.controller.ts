import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalUser } from '../../common/decorators/optional-user.decorator';
import { User } from '../../entities/user.entity';
import { BookClubService } from './book-club.service';

@Controller()
export class BookClubController {
  constructor(private readonly bookClubService: BookClubService) {}

  @Post('clubs')
  async createClub(@CurrentUser() user: User, @Body() body: { name?: string; description?: string }) {
    return ApiResponse.success(
      await this.bookClubService.createClub(user, body?.name ?? '', body?.description),
      'Đã tạo câu lạc bộ',
    );
  }

  @Get('clubs')
  async getClubs(
    @OptionalUser() user: User | null,
    @Query('page') page = '0',
    @Query('size') size = '20',
  ) {
    return ApiResponse.success(await this.bookClubService.getClubs(user, Number(page), Number(size)));
  }

  @Get('clubs/:id')
  async getClub(@OptionalUser() user: User | null, @Param('id', ParseIntPipe) id: number) {
    return ApiResponse.success(await this.bookClubService.getClub(user, id));
  }

  @Post('clubs/:id/join')
  async joinClub(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    await this.bookClubService.joinClub(user, id);
    return ApiResponse.success(null, 'Đã tham gia câu lạc bộ');
  }

  @Post('clubs/:id/leave')
  async leaveClub(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    await this.bookClubService.leaveClub(user, id);
    return ApiResponse.success(null, 'Đã rời câu lạc bộ');
  }

  @Get('clubs/:id/members')
  async getMembers(@Param('id', ParseIntPipe) id: number) {
    return ApiResponse.success(await this.bookClubService.getMembers(id));
  }

  @Get('clubs/:id/discussions')
  async getDiscussions(
    @OptionalUser() user: User | null,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = '0',
    @Query('size') size = '20',
  ) {
    return ApiResponse.success(
      await this.bookClubService.getDiscussions(user, id, Number(page), Number(size)),
    );
  }

  @Post('clubs/:id/discussions')
  async createDiscussion(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content?: string; bookId?: number },
  ) {
    return ApiResponse.success(
      await this.bookClubService.createDiscussion(user, id, body?.content ?? '', body?.bookId),
      'Đã đăng thảo luận',
    );
  }

  @Post('discussions/:id/like')
  async likeDiscussion(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    await this.bookClubService.likeDiscussion(user, id);
    return ApiResponse.success(null, 'Đã thích thảo luận');
  }
}
