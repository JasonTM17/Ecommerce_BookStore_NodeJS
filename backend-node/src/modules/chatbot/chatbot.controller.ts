import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../entities/enums';
import { User } from '../../entities/user.entity';
import { ChatbotService } from './chatbot.service';

export class ChatMessageRequestDto {
  @IsNotEmpty({ message: 'Tin nhắn không được để trống' })
  @IsString()
  message: string;

  @IsOptional() @Type(() => Number) @IsInt() conversationId?: number;
  @IsOptional() @IsString() conversationTitle?: string;
}

export class ChatFeedbackRequestDto {
  @Type(() => Number) @IsInt() messageId: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() isHelpful?: boolean;
  @IsOptional() @IsString() improvementSuggestion?: string;
}

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('message')
  async sendMessage(@CurrentUser() user: User, @Body() request: ChatMessageRequestDto) {
    return ApiResponse.success(await this.chatbotService.chat(user, request));
  }

  @Get('conversations')
  async getConversations(@CurrentUser() user: User) {
    return ApiResponse.success(await this.chatbotService.getUserConversations(user));
  }

  @Get('conversations/:id')
  async getConversationDetail(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return ApiResponse.success(await this.chatbotService.getConversationDetail(user, id));
  }

  @Delete('conversations/:id')
  async deleteConversation(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    await this.chatbotService.deleteConversation(user, id);
    return ApiResponse.success(null, 'Đã xóa cuộc trò chuyện');
  }

  @Post('feedback')
  async submitFeedback(@CurrentUser() user: User, @Body() request: ChatFeedbackRequestDto) {
    await this.chatbotService.submitFeedback(user, request);
    return ApiResponse.success(null, 'Cảm ơn phản hồi của bạn');
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  async getChatbotStats() {
    return ApiResponse.success(await this.chatbotService.getChatbotStats());
  }

  @Public()
  @Get('health')
  checkHealth() {
    return ApiResponse.success(this.chatbotService.getHealthStatus());
  }
}
