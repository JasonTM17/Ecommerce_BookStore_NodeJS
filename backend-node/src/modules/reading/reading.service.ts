import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { ReadingStatus } from '../../entities/enums';
import { Product } from '../../entities/product.entity';
import { ReadingChallenge } from '../../entities/reading-challenge.entity';
import { ReadingProgress } from '../../entities/reading-progress.entity';
import { ReadingStreak } from '../../entities/reading-streak.entity';
import { User } from '../../entities/user.entity';

function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

@Injectable()
export class ReadingService {
  constructor(
    @InjectRepository(ReadingProgress) private readonly progress: Repository<ReadingProgress>,
    @InjectRepository(ReadingChallenge) private readonly challenges: Repository<ReadingChallenge>,
    @InjectRepository(ReadingStreak) private readonly streaks: Repository<ReadingStreak>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async startReading(user: User, productId: number) {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) throw new ResourceNotFoundException('Product', 'id', productId);

    const existing = await this.progress.findOne({
      where: { user: { id: user.id }, product: { id: productId } },
    });
    if (existing) throw new BadRequestException('Bạn đã bắt đầu đọc sách này rồi');

    const entry = this.progress.create({
      user,
      product,
      status: ReadingStatus.WANT_TO_READ,
      totalPages: product.pageCount ?? null,
      startedAt: new Date(),
    });
    const saved = await this.progress.save(entry);
    await this.updateStreak(user);
    return this.toResponse(saved);
  }

  async updateProgress(user: User, progressId: number, currentPage: number, status?: string) {
    const entry = await this.requireOwned(user, progressId);
    entry.updateProgress(currentPage);
    if (status && Object.values(ReadingStatus).includes(status as ReadingStatus)) {
      entry.status = status as ReadingStatus;
      if (status === ReadingStatus.FINISHED && !entry.finishedAt) {
        entry.finishedAt = new Date();
        entry.progressPercent = 100;
        if (entry.totalPages) entry.currentPage = entry.totalPages;
      }
    }
    const saved = await this.progress.save(entry);
    if (saved.status === ReadingStatus.FINISHED) {
      await this.updateStreak(user);
      await this.updateChallenge(user);
    }
    return this.toResponse(saved);
  }

  async finishBook(user: User, progressId: number, rating?: number, review?: string) {
    const entry = await this.requireOwned(user, progressId);
    entry.status = ReadingStatus.FINISHED;
    entry.finishedAt = new Date();
    if (rating != null) entry.rating = rating;
    if (review != null) entry.review = review;
    if (entry.totalPages != null) {
      entry.currentPage = entry.totalPages;
      entry.progressPercent = 100;
    }
    const saved = await this.progress.save(entry);
    await this.updateStreak(user);
    await this.updateChallenge(user);
    return this.toResponse(saved);
  }

  async getUserProgress(user: User) {
    const entries = await this.progress.find({
      where: { user: { id: user.id } },
      relations: ['product'],
      order: { updatedAt: 'DESC' },
    });
    return entries.map((e) => this.toResponse(e));
  }

  async getStats(user: User) {
    const base = { user: { id: user.id } } as const;
    const [totalBooks, wantToRead, currentlyReading, finishedBooks] = await Promise.all([
      this.progress.count({ where: base }),
      this.progress.count({ where: { ...base, status: ReadingStatus.WANT_TO_READ } }),
      this.progress.count({ where: { ...base, status: ReadingStatus.READING } }),
      this.progress.count({ where: { ...base, status: ReadingStatus.FINISHED } }),
    ]);

    const streak = await this.streaks.findOne({ where: { user: { id: user.id } } });
    const year = new Date().getFullYear();
    const challenge = await this.challenges.findOne({
      where: { user: { id: user.id }, challengeYear: year },
    });

    const finished = await this.progress.find({
      where: { ...base, status: ReadingStatus.FINISHED },
      relations: ['product', 'product.category'],
    });
    const totalPagesRead = finished.reduce((s, e) => s + (e.totalPages ?? e.currentPage ?? 0), 0);

    const genreCounts = new Map<string, number>();
    for (const e of finished) {
      const genre = e.product?.category?.name;
      if (genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    const topGenres = [...genreCounts.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const ratings = finished.map((e) => e.rating).filter((r): r is number => r != null);
    const averageRating = ratings.length
      ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 100) / 100
      : 0;

    // merged shape: Java ReadingStatsResponse + frontend ReadingStats fields
    return {
      totalBooks,
      wantToRead,
      currentlyReading,
      finishedBooks,
      totalPagesRead,
      streak: streak
        ? {
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            totalReadingDays: streak.totalReadingDays,
            lastReadDate: streak.lastReadDate,
          }
        : null,
      challenge: challenge
        ? {
            targetBooks: challenge.targetBooks,
            completedBooks: challenge.completedBooks,
            challengeYear: challenge.challengeYear,
            isCompleted: challenge.isCompleted,
            progressPercent: challenge.targetBooks > 0
              ? Math.floor((challenge.completedBooks * 100) / challenge.targetBooks)
              : 0,
          }
        : null,
      topGenres,
      // frontend-facing aliases
      totalBooksRead: finishedBooks,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      averageRating,
      favoriteGenre: topGenres[0]?.genre ?? null,
      monthlyReading: this.monthlyReading(finished),
    };
  }

  async getStreak(user: User) {
    const streak = await this.streaks.findOne({ where: { user: { id: user.id } } });
    return {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      totalReadingDays: streak?.totalReadingDays ?? 0,
      lastReadDate: streak?.lastReadDate ?? null,
    };
  }

  async getChallenges(user: User) {
    const list = await this.challenges.find({
      where: { user: { id: user.id } },
      order: { challengeYear: 'DESC' },
    });
    return list.map((c) => this.toChallengeResponse(c));
  }

  async createChallenge(user: User, year: number, targetBooks: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      throw new BadRequestException('Năm thử thách không hợp lệ');
    }
    if (!Number.isInteger(targetBooks) || targetBooks <= 0) {
      throw new BadRequestException('Số sách mục tiêu phải lớn hơn 0');
    }
    let challenge = await this.challenges.findOne({
      where: { user: { id: user.id }, challengeYear: year },
    });
    if (challenge) {
      challenge.targetBooks = targetBooks;
    } else {
      challenge = this.challenges.create({
        user,
        challengeYear: year,
        targetBooks,
        completedBooks: 0,
        startedAt: new Date(),
      });
    }
    return this.toChallengeResponse(await this.challenges.save(challenge));
  }

  private monthlyReading(finished: ReadingProgress[]) {
    const counts = new Map<string, number>();
    for (const e of finished) {
      if (!e.finishedAt) continue;
      const d = new Date(e.finishedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }

  private async updateStreak(user: User): Promise<void> {
    let streak = await this.streaks.findOne({ where: { user: { id: user.id } } });
    if (!streak) {
      streak = this.streaks.create({ user, currentStreak: 0, longestStreak: 0, totalReadingDays: 0 });
    }
    const today = localDate(new Date());
    const yesterday = localDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (streak.lastReadDate == null) {
      streak.currentStreak = 1;
      streak.totalReadingDays = 1;
    } else if (streak.lastReadDate === yesterday) {
      streak.currentStreak += 1;
      streak.totalReadingDays += 1;
    } else if (streak.lastReadDate !== today) {
      streak.currentStreak = 1;
    }
    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }
    streak.lastReadDate = today;
    await this.streaks.save(streak);
  }

  private async updateChallenge(user: User): Promise<void> {
    const year = new Date().getFullYear();
    let challenge = await this.challenges.findOne({
      where: { user: { id: user.id }, challengeYear: year },
    });
    if (!challenge) {
      challenge = this.challenges.create({
        user, challengeYear: year, targetBooks: 12, completedBooks: 0,
      });
    }
    challenge.completedBooks = await this.progress.count({
      where: { user: { id: user.id }, status: ReadingStatus.FINISHED },
    });
    if (challenge.completedBooks >= challenge.targetBooks) {
      challenge.isCompleted = true;
      challenge.finishedAt = new Date();
    }
    await this.challenges.save(challenge);
  }

  private async requireOwned(user: User, progressId: number): Promise<ReadingProgress> {
    const entry = await this.progress.findOne({
      where: { id: progressId },
      relations: ['user', 'product'],
    });
    if (!entry) throw new ResourceNotFoundException('ReadingProgress', 'id', progressId);
    if (entry.user.id !== user.id) {
      throw new BadRequestException('Bạn không có quyền cập nhật tiến độ này');
    }
    return entry;
  }

  private toChallengeResponse(c: ReadingChallenge) {
    return {
      id: c.id,
      year: c.challengeYear,
      challengeYear: c.challengeYear,
      targetBooks: c.targetBooks,
      completedBooks: c.completedBooks,
      isCompleted: c.isCompleted,
      startedAt: c.startedAt,
      finishedAt: c.finishedAt,
      createdAt: c.createdAt,
    };
  }

  /** Merged shape: Java's flat fields + frontend's nested `product` object. */
  private toResponse(rp: ReadingProgress) {
    const p = rp.product;
    return {
      id: rp.id,
      productId: p.id,
      productName: p.name,
      productAuthor: p.author,
      productImage: p.imageUrl,
      product: { id: p.id, name: p.name, author: p.author, imageUrl: p.imageUrl },
      status: rp.status,
      currentPage: rp.currentPage,
      totalPages: rp.totalPages,
      progressPercent: rp.progressPercent,
      startedAt: rp.startedAt,
      finishedAt: rp.finishedAt,
      rating: rp.rating,
      review: rp.review,
      createdAt: rp.createdAt,
    };
  }
}
