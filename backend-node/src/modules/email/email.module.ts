import { Module } from '@nestjs/common';
import { EmailTestController } from './email.controller';
import { EmailService } from './email.service';

@Module({
  controllers: [EmailTestController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
