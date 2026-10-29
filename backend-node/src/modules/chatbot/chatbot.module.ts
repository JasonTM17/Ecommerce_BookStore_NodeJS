import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatConversation } from '../../entities/chat-conversation.entity';
import { ChatFeedback } from '../../entities/chat-feedback.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { Order } from '../../entities/order.entity';
import { Product } from '../../entities/product.entity';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatConversation, ChatMessage, ChatFeedback, Product, Order,
    ]),
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
