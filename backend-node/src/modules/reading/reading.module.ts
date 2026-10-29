import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../entities/product.entity';
import { ReadingChallenge } from '../../entities/reading-challenge.entity';
import { ReadingProgress } from '../../entities/reading-progress.entity';
import { ReadingStreak } from '../../entities/reading-streak.entity';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReadingProgress, ReadingChallenge, ReadingStreak, Product]),
  ],
  controllers: [ReadingController],
  providers: [ReadingService],
})
export class ReadingModule {}
