import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { loadConfig } from './config/configuration';
import { buildDataSourceOptions } from './database/typeorm.config';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { ClubsModule } from './modules/clubs/clubs.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { EmailModule } from './modules/email/email.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { IsbnModule } from './modules/isbn/isbn.module';
import { MiscModule } from './modules/misc/misc.module';
import { ReadingModule } from './modules/reading/reading.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfig] }),
    TypeOrmModule.forRoot(buildDataSourceOptions(loadConfig())),
    AuthModule,
    UsersModule,
    CatalogModule,
    CommerceModule,
    EngagementModule,
    ReadingModule,
    ClubsModule,
    ChatbotModule,
    FilesModule,
    AdminModule,
    HealthModule,
    IsbnModule,
    MiscModule,
    EmailModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('*');
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
