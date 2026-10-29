import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toSpringPage, SpringPage } from '../../common/dto/api-response.dto';
import {
  BadRequestException,
  ConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { BookClubMember } from '../../entities/book-club-member.entity';
import { BookClub } from '../../entities/book-club.entity';
import { BookDiscussionLike } from '../../entities/book-discussion-like.entity';
import { BookDiscussion } from '../../entities/book-discussion.entity';
import { BookClubRole } from '../../entities/enums';
import { Product } from '../../entities/product.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class BookClubService {
  constructor(
    @InjectRepository(BookClub) private readonly clubs: Repository<BookClub>,
    @InjectRepository(BookClubMember) private readonly members: Repository<BookClubMember>,
    @InjectRepository(BookDiscussion) private readonly discussions: Repository<BookDiscussion>,
    @InjectRepository(BookDiscussionLike) private readonly likes: Repository<BookDiscussionLike>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async createClub(user: User, name: string, description?: string) {
    if (!name?.trim()) throw new BadRequestException('Tên câu lạc bộ không được để trống');
    const club = await this.clubs.save(this.clubs.create({
      name: name.trim(),
      description: description ?? null,
      owner: user,
      isPublic: true,
      isActive: true,
      memberCount: 1,
    }));
    await this.members.save(this.members.create({ club, user, role: BookClubRole.OWNER }));
    return this.toClubResponse(club, true);
  }

  async getClubs(user: User | null, page: number, size: number): Promise<SpringPage<unknown>> {
    const [clubs, total] = await this.clubs.findAndCount({
      where: { isActive: true, isPublic: true },
      relations: ['owner', 'currentBook'],
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    const joined = await this.joinedClubIds(user, clubs.map((c) => c.id));
    return toSpringPage(
      clubs.map((c) => this.toClubResponse(c, joined.has(c.id))),
      total, page, size,
    );
  }

  async getClub(user: User | null, id: number) {
    const club = await this.requireClub(id);
    const joined = user
      ? !!(await this.members.findOne({ where: { club: { id }, user: { id: user.id } } }))
      : false;
    return this.toClubResponse(club, joined);
  }

  async joinClub(user: User, clubId: number): Promise<void> {
    const club = await this.requireClub(clubId);
    if (await this.members.findOne({ where: { club: { id: clubId }, user: { id: user.id } } })) {
      throw new ConflictException('Bạn đã là thành viên của câu lạc bộ này');
    }
    await this.members.save(this.members.create({ club, user, role: BookClubRole.MEMBER }));
    club.memberCount += 1;
    await this.clubs.save(club);
  }

  async leaveClub(user: User, clubId: number): Promise<void> {
    const club = await this.requireClub(clubId);
    const member = await this.members.findOne({
      where: { club: { id: clubId }, user: { id: user.id } },
    });
    if (!member) throw new BadRequestException('Bạn không phải thành viên của câu lạc bộ này');
    if (member.role === BookClubRole.OWNER) {
      throw new BadRequestException('Chủ câu lạc bộ không thể rời khỏi');
    }
    await this.members.remove(member);
    club.memberCount = Math.max(0, club.memberCount - 1);
    await this.clubs.save(club);
  }

  async getMembers(clubId: number) {
    await this.requireClub(clubId);
    const members = await this.members.find({
      where: { club: { id: clubId } },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      userName: m.user.fullName,
      user: {
        id: m.user.id,
        fullName: m.user.fullName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      },
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async getDiscussions(user: User | null, clubId: number, page: number, size: number) {
    await this.requireClub(clubId);
    const [discussions] = await this.discussions.findAndCount({
      where: { club: { id: clubId } },
      relations: ['user', 'product', 'club'],
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });
    const likedIds = await this.likedDiscussionIds(user, discussions.map((d) => d.id));
    return discussions.map((d) => this.toDiscussionResponse(d, likedIds.has(d.id)));
  }

  async createDiscussion(user: User, clubId: number, content: string, bookId?: number) {
    const club = await this.requireClub(clubId);
    const member = await this.members.findOne({
      where: { club: { id: clubId }, user: { id: user.id } },
    });
    if (!member) throw new BadRequestException('Bạn phải là thành viên để đăng thảo luận');
    if (!content?.trim()) throw new BadRequestException('Nội dung không được để trống');

    let product: Product | null = null;
    if (bookId != null) {
      product = await this.products.findOne({ where: { id: bookId } });
      if (!product) throw new ResourceNotFoundException('Product', 'id', bookId);
    }

    const discussion = await this.discussions.save(this.discussions.create({
      club,
      user,
      product,
      content: content.trim(),
    }));
    return this.toDiscussionResponse(discussion, false);
  }

  async likeDiscussion(user: User, discussionId: number): Promise<void> {
    const discussion = await this.discussions.findOne({ where: { id: discussionId } });
    if (!discussion) throw new ResourceNotFoundException('BookDiscussion', 'id', discussionId);

    const existing = await this.likes.findOne({
      where: { discussion: { id: discussionId }, user: { id: user.id } },
    });
    if (existing) return; // idempotent like

    await this.discussions.manager.transaction(async (em) => {
      await em.save(em.create(BookDiscussionLike, { discussion, user }));
      await em.increment(BookDiscussion, { id: discussionId }, 'likesCount', 1);
    });
  }

  private async requireClub(id: number): Promise<BookClub> {
    const club = await this.clubs.findOne({
      where: { id },
      relations: ['owner', 'currentBook'],
    });
    if (!club) throw new ResourceNotFoundException('BookClub', 'id', id);
    return club;
  }

  private async joinedClubIds(user: User | null, clubIds: number[]): Promise<Set<number>> {
    if (!user || clubIds.length === 0) return new Set();
    const rows = await this.members
      .createQueryBuilder('m')
      .select('m.club_id', 'clubId')
      .where('m.user.id = :uid', { uid: user.id })
      .andWhere('m.club.id IN (:...ids)', { ids: clubIds })
      .getRawMany<{ clubId: number }>();
    return new Set(rows.map((r) => Number(r.clubId)));
  }

  private async likedDiscussionIds(user: User | null, ids: number[]): Promise<Set<number>> {
    if (!user || ids.length === 0) return new Set();
    const rows = await this.likes
      .createQueryBuilder('l')
      .select('l.discussion_id', 'discussionId')
      .where('l.user.id = :uid', { uid: user.id })
      .andWhere('l.discussion.id IN (:...ids)', { ids })
      .getRawMany<{ discussionId: number }>();
    return new Set(rows.map((r) => Number(r.discussionId)));
  }

  /** Merged shape: Java BookClubResponse + frontend's nested owner/currentBook/isJoined. */
  private toClubResponse(club: BookClub, isJoined: boolean) {
    return {
      id: club.id,
      name: club.name,
      description: club.description,
      coverImage: club.coverImage,
      ownerName: club.owner?.fullName ?? null,
      owner: club.owner
        ? { id: club.owner.id, fullName: club.owner.fullName, email: club.owner.email }
        : null,
      currentBookId: club.currentBook?.id ?? null,
      currentBookTitle: club.currentBook?.name ?? null,
      currentBook: club.currentBook
        ? {
            id: club.currentBook.id,
            name: club.currentBook.name,
            author: club.currentBook.author,
            imageUrl: club.currentBook.imageUrl,
          }
        : null,
      memberCount: club.memberCount,
      isPublic: club.isPublic,
      isActive: club.isActive,
      isJoined,
      createdAt: club.createdAt,
    };
  }

  private toDiscussionResponse(d: BookDiscussion, isLiked: boolean) {
    return {
      id: d.id,
      club: d.club ? { id: d.club.id, name: d.club.name } : null,
      clubId: d.club?.id ?? null,
      book: d.product ? { id: d.product.id, name: d.product.name } : null,
      user: d.user
        ? { id: d.user.id, fullName: d.user.fullName, avatarUrl: d.user.avatarUrl }
        : null,
      content: d.content,
      likes: d.likesCount,
      likesCount: d.likesCount,
      views: d.viewsCount,
      commentCount: 0,
      isLiked,
      createdAt: d.createdAt,
    };
  }
}
