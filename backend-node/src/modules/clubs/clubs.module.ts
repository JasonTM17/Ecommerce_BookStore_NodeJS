import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookClubMember } from '../../entities/book-club-member.entity';
import { BookClub } from '../../entities/book-club.entity';
import { BookDiscussionLike } from '../../entities/book-discussion-like.entity';
import { BookDiscussion } from '../../entities/book-discussion.entity';
import { Product } from '../../entities/product.entity';
import { BookClubController } from './book-club.controller';
import { BookClubService } from './book-club.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookClub, BookClubMember, BookDiscussion, BookDiscussionLike, Product,
    ]),
  ],
  controllers: [BookClubController],
  providers: [BookClubService],
})
export class ClubsModule {}
