import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { ChatConversation } from '../../entities/chat-conversation.entity';
import { ChatFeedback } from '../../entities/chat-feedback.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { MessageRole } from '../../entities/enums';
import { Order } from '../../entities/order.entity';
import { Product } from '../../entities/product.entity';
import { User } from '../../entities/user.entity';

const SYSTEM_PROMPT = `Bạn là trợ lý bán sách thân thiện của BookStore - một cửa hàng sách trực tuyến hàng đầu tại Việt Nam.

NHIỆM VỤ CỦA BẠN:
- Tư vấn sách theo sở thích, độ tuổi, thể loại yêu thích của khách hàng
- Trả lời câu hỏi về sản phẩm, đơn hàng, đổi trả, vận chuyển
- So sánh các cuốn sách khi được yêu cầu
- Hỗ trợ tìm kiếm sách theo tác giả, thể loại, chủ đề
- Luôn khuyến khích mua sách một cách tự nhiên

PHONG CÁCH TRẢ LỜI:
- Thân thiện, gần gũi như đang trò chuyện với người bạn
- Sử dụng tiếng Việt, có thể xen lẫn tiếng Anh cho tên sách/tác giả
- Trả lời NGẮN GỌN (dưới 200 từ) trừ khi cần chi tiết
- Nếu không biết thì gợi ý trang Liên hệ hoặc email support@bookstore.com

CÁC TÍNH NĂNG CỦA CỬA HÀNG:
- Giao hàng toàn quốc, miễn phí vận chuyển cho đơn từ 200.000đ
- Đổi trả trong 7 ngày nếu sách lỗi
- Thường xuyên có flash sale và mã giảm giá
- Hỗ trợ thanh toán qua VNPay, COD

QUY TẮC QUAN TRỌNG:
- Không bịa đặt thông tin sách
- Không đề cập là mình là AI/chatbot
- Luôn hỏi thêm để đưa ra gợi ý chính xác hơn
- Không spam quảng cáo, chỉ suggest khi phù hợp`;

const FALLBACK_RESPONSE = `Xin lỗi bạn, hiện tại mình đang gặp chút trục trặc kỹ thuật.

Bạn có thể:
- Thử hỏi lại câu hỏi của mình
- Mở trang Liên hệ để gửi yêu cầu hỗ trợ
- Email support@bookstore.com nếu cần kiểm tra đơn hàng gấp

Cảm ơn bạn đã thông cảm.`;

const DISABLED_RESPONSE = `Tính năng tư vấn AI hiện đang tạm tắt trong môi trường này.

Bạn vẫn có thể:
- Duyệt danh mục sách và tìm kiếm trực tiếp trên cửa hàng
- Mở trang Liên hệ để gửi yêu cầu hỗ trợ
- Email support@bookstore.com nếu cần kiểm tra đơn hàng gấp

Khi trợ lý được bật lại, mình sẽ hỗ trợ tư vấn chi tiết hơn.`;

interface GeneratedReply {
  content: string;
  providerResponse: boolean;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private lastSuccessAt: Date | null = null;
  private lastFailureAt: Date | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(ChatConversation) private readonly conversations: Repository<ChatConversation>,
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
    @InjectRepository(ChatFeedback) private readonly feedback: Repository<ChatFeedback>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  private get grokEnabled(): boolean {
    return this.config.get<boolean>('grok.enabled') ?? false;
  }

  private get grokApiKey(): string {
    return this.config.get<string>('grok.apiKey') ?? '';
  }

  async chat(user: User, request: { message: string; conversationId?: number; conversationTitle?: string }) {
    const startTime = Date.now();
    const conversation = await this.getOrCreateConversation(
      user, request.conversationId, request.conversationTitle,
    );

    const history = await this.getConversationHistory(conversation);
    const messages = await this.buildMessages(history, request.message, user);
    const generated = await this.generateReply(messages, user);
    const latency = Date.now() - startTime;

    await this.messages.save(this.messages.create({
      conversation,
      role: MessageRole.USER,
      content: request.message,
      isFromGrok: false,
    }));

    const aiMessage = await this.messages.save(this.messages.create({
      conversation,
      role: MessageRole.ASSISTANT,
      content: generated.content,
      isFromGrok: generated.providerResponse,
      modelUsed: this.getModelName(),
      latencyMs: latency,
    }));

    conversation.messageCount = (conversation.messageCount ?? 0) + 2;
    await this.conversations.save(conversation);

    return {
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      reply: aiMessage.content,
      role: MessageRole.ASSISTANT,
      modelUsed: aiMessage.modelUsed,
      latencyMs: aiMessage.latencyMs,
      createdAt: aiMessage.createdAt,
      bookSuggestions: await this.extractBookSuggestions(aiMessage.content),
      quickActions: this.buildQuickActions(aiMessage.content),
    };
  }

  private async generateReply(
    messages: { role: string; content: string }[],
    _user: User,
  ): Promise<GeneratedReply> {
    if (!this.grokEnabled) {
      return { content: DISABLED_RESPONSE, providerResponse: false };
    }
    if (!this.grokApiKey) {
      this.logger.warn('Grok enabled but GROK_API_KEY is blank, using fallback response');
      this.markFailure('missing api key');
      return { content: FALLBACK_RESPONSE, providerResponse: false };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(this.config.get<string>('grok.apiUrl')!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.grokApiKey}`,
        },
        body: JSON.stringify({
          model: this.config.get<string>('grok.model'),
          messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const body = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = body?.choices?.[0]?.message?.content ?? '';
        if (!content.trim()) {
          this.markFailure('empty message content');
          return { content: FALLBACK_RESPONSE, providerResponse: false };
        }
        this.markSuccess();
        return { content, providerResponse: true };
      }
      this.markFailure(`HTTP ${response.status}`);
      return { content: FALLBACK_RESPONSE, providerResponse: false };
    } catch (e) {
      this.markFailure(e instanceof Error ? e.message : String(e));
      return { content: FALLBACK_RESPONSE, providerResponse: false };
    }
  }

  getHealthStatus(): Record<string, string> {
    const status = this.getStatus();
    return {
      status,
      service: this.grokEnabled ? 'Grok AI Chatbot' : 'BookStore Chatbot',
      model: this.getModelName(),
      message: this.getStatusMessage(status),
      providerEnabled: String(this.grokEnabled),
    };
  }

  private getStatus(): string {
    if (!this.grokEnabled) return 'DISABLED';
    if (!this.grokApiKey) return 'DEGRADED';
    if (this.lastFailureAt && (!this.lastSuccessAt || this.lastFailureAt > this.lastSuccessAt)) {
      return 'DEGRADED';
    }
    return 'UP';
  }

  private getModelName(): string {
    return this.grokEnabled ? (this.config.get<string>('grok.model') ?? 'grok-3') : 'disabled';
  }

  private getStatusMessage(status: string): string {
    if (status === 'DISABLED') return 'Chatbot đang được tắt cho môi trường này.';
    if (status === 'DEGRADED') {
      return !this.grokApiKey
        ? 'Trợ lý AI đang ở chế độ dự phòng do cấu hình provider chưa hoàn tất.'
        : 'Trợ lý AI đã được cấu hình nhưng lần gọi gần nhất chưa ổn định. Chatbot đang dùng chế độ dự phòng.';
    }
    return this.grokEnabled ? 'Grok đã được cấu hình và sẵn sàng trả lời.' : 'Chatbot sẵn sàng hỗ trợ.';
  }

  private markSuccess(): void {
    this.lastSuccessAt = new Date();
    this.lastFailureAt = null;
  }

  private markFailure(_message: string): void {
    this.lastFailureAt = new Date();
  }

  private async getOrCreateConversation(
    user: User, conversationId?: number, title?: string,
  ): Promise<ChatConversation> {
    if (conversationId != null) {
      const conversation = await this.conversations.findOne({
        where: { id: conversationId, user: { id: user.id } },
      });
      if (!conversation) throw new ResourceNotFoundException('Conversation', 'id', conversationId);
      return conversation;
    }
    return this.conversations.save(this.conversations.create({
      user,
      title: title?.trim() || 'Cuộc trò chuyện mới',
      isActive: true,
      messageCount: 0,
    }));
  }

  private async getConversationHistory(conversation: ChatConversation): Promise<ChatMessage[]> {
    const limit = (this.config.get<number>('grok.maxContextMessages') ?? 10) * 2;
    const recent = await this.messages.find({
      where: { conversation: { id: conversation.id } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return recent.reverse();
  }

  private async buildMessages(history: ChatMessage[], newMessage: string, user: User) {
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT + (await this.buildUserContext(user)) },
    ];
    for (const m of history) {
      messages.push({
        role: m.role === MessageRole.USER ? 'user' : 'assistant',
        content: m.content,
      });
    }
    messages.push({ role: 'user', content: newMessage });
    return messages;
  }

  private async buildUserContext(user: User): Promise<string> {
    let context = '\n\nTHÔNG TIN KHÁCH HÀNG:';
    const displayName = user.fullName;
    context += `\n- Tên hiển thị: ${displayName?.trim() ? displayName : 'Khách hàng đã đăng nhập'}`;
    try {
      const orderCount = await this.orders.count({ where: { user: { id: user.id } } });
      context += `\n- Số đơn hàng đã mua: ${orderCount}`;
    } catch {
      context += '\n- Số đơn hàng đã mua: 0';
    }
    context += '\n\nTrả lời khách hàng một cách tự nhiên, có thể đề cập đến lịch sử mua hàng nếu phù hợp.';
    return context;
  }

  private async extractBookSuggestions(reply: string) {
    const lower = reply.toLowerCase();
    if (!/(goi y|recommend|cuon sach|doc)/.test(lower)) return [];
    try {
      const top = await this.products.find({
        where: { isActive: true },
        order: { soldCount: 'DESC' },
        take: 3,
      });
      return top.map((p) => ({
        productId: p.id,
        title: p.name,
        author: p.author,
        price: p.currentPrice ?? 0,
        imageUrl: p.imageUrl,
        averageRating: p.avgRating,
        reason: 'Gợi ý từ AI',
      }));
    } catch {
      return [];
    }
  }

  private buildQuickActions(reply: string) {
    const lower = reply.toLowerCase();
    const actions: { action: string; label: string; icon: string }[] = [];
    if (lower.includes('tim') || lower.includes('search')) {
      actions.push({ action: 'search', label: 'Tìm kiếm sách', icon: 'search' });
    }
    if (lower.includes('don hang') || lower.includes('order')) {
      actions.push({ action: 'track_order', label: 'Theo dõi đơn hàng', icon: 'package' });
    }
    if (lower.includes('gio hang') || lower.includes('cart')) {
      actions.push({ action: 'view_cart', label: 'Xem giỏ hàng', icon: 'shopping-cart' });
    }
    if (lower.includes('khuyen mai') || lower.includes('sale')) {
      actions.push({ action: 'view_promotions', label: 'Xem khuyến mãi', icon: 'tag' });
    }
    return actions;
  }

  async getUserConversations(user: User) {
    const conversations = await this.conversations.find({
      where: { user: { id: user.id }, isActive: true },
      order: { updatedAt: 'DESC' },
    });
    return Promise.all(conversations.map((c) => this.toConversationResponse(c)));
  }

  async getConversationDetail(user: User, conversationId: number) {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId, user: { id: user.id } },
    });
    if (!conversation) throw new ResourceNotFoundException('Conversation', 'id', conversationId);

    const messages = await this.messages.find({
      where: { conversation: { id: conversation.id } },
      order: { createdAt: 'ASC' },
    });

    return {
      id: conversation.id,
      title: conversation.title,
      isActive: conversation.isActive,
      messageCount: conversation.messageCount,
      lastMessage: messages.length ? messages[messages.length - 1].content : '',
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      recentMessages: messages.map((m) => ({
        id: m.id,
        role: m.role.toLowerCase(),
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  async deleteConversation(user: User, conversationId: number): Promise<void> {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId, user: { id: user.id } },
    });
    if (!conversation) throw new ResourceNotFoundException('Conversation', 'id', conversationId);
    conversation.isActive = false;
    await this.conversations.save(conversation);
  }

  async submitFeedback(user: User, request: {
    messageId?: number; rating?: number; comment?: string;
    isHelpful?: boolean; improvementSuggestion?: string;
  }): Promise<void> {
    if (request.messageId == null) {
      throw new BadRequestException('Message ID khong duoc de trong');
    }
    const message = await this.messages.findOne({
      where: { id: request.messageId },
      relations: ['conversation', 'conversation.user'],
    });
    if (!message) throw new ResourceNotFoundException('ChatMessage', 'id', request.messageId);
    if (message.conversation.user.id !== user.id) {
      throw new BadRequestException('Ban khong co quyen danh gia tin nhan nay');
    }
    const existing = await this.feedback.findOne({
      where: { message: { id: request.messageId } },
    });
    if (existing) throw new BadRequestException('Ban da danh gia tin nhan nay roi');

    await this.feedback.save(this.feedback.create({
      message,
      rating: request.rating ?? 5,
      comment: request.comment ?? null,
      isHelpful: request.isHelpful ?? null,
      improvementSuggestion: request.improvementSuggestion ?? null,
    }));
  }

  async getChatbotStats() {
    const [totalConversations, totalMessages, grokMessages, totalFeedback] = await Promise.all([
      this.conversations.count(),
      this.messages.count(),
      this.messages.find({ where: { isFromGrok: true } }),
      this.feedback.count(),
    ]);
    const avgLatency = grokMessages.length
      ? grokMessages.reduce((s, m) => s + (m.latencyMs ?? 0), 0) / grokMessages.length
      : 0;
    return {
      totalConversations,
      totalMessages,
      grokResponses: grokMessages.length,
      totalFeedback,
      averageResponseTime: avgLatency,
    };
  }

  private async toConversationResponse(conversation: ChatConversation) {
    const last = await this.messages.findOne({
      where: { conversation: { id: conversation.id } },
      order: { createdAt: 'DESC' },
    });
    return {
      id: conversation.id,
      title: conversation.title,
      isActive: conversation.isActive,
      messageCount: conversation.messageCount,
      lastMessage: last?.content ?? '',
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}
