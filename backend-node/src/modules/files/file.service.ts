import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '../../common/exceptions';
import { FileStore, LocalFileStore, SupabaseFileStore } from './file-store';

const ALLOWED_EXTENSIONS = new Map<string, Set<string>>([
  ['.jpg', new Set(['image/jpeg', 'image/jpg', 'image/pjpeg'])],
  ['.jpeg', new Set(['image/jpeg', 'image/jpg', 'image/pjpeg'])],
  ['.png', new Set(['image/png'])],
  ['.gif', new Set(['image/gif'])],
  ['.webp', new Set(['image/webp'])],
]);

@Injectable()
export class FileService {
  private readonly localStore: LocalFileStore;
  private readonly supabaseStore: SupabaseFileStore;

  constructor(private readonly config: ConfigService) {
    this.localStore = new LocalFileStore(this.uploadDir, this.baseUrl);
    this.supabaseStore = new SupabaseFileStore(
      this.config.get<string>('storage.supabaseUrl') ?? '',
      this.config.get<string>('storage.serviceRoleKey') ?? '',
      this.config.get<string>('storage.bucket') ?? 'uploads',
    );
  }

  private get uploadDir(): string {
    return path.resolve(this.config.get<string>('upload.dir') ?? 'uploads');
  }

  private get baseUrl(): string {
    return this.config.get<string>('upload.baseUrl') ?? '/api/uploads';
  }

  private get maxFileSize(): number {
    return this.config.get<number>('upload.maxFileSize') ?? 10 * 1024 * 1024;
  }

  /** Uploads go to the configured driver; deletes route by URL shape. */
  private get uploadStore(): FileStore {
    return (this.config.get<string>('storage.driver') ?? 'local') === 'supabase'
      ? this.supabaseStore
      : this.localStore;
  }

  async storeImage(file: Express.Multer.File): Promise<string> {
    if (!file) throw new BadRequestException('File không được để trống');
    if (file.size <= 0) throw new BadRequestException('File rỗng');
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File vượt quá kích thước cho phép (${Math.round(this.maxFileSize / 1024 / 1024)}MB)`,
      );
    }

    const ext = path.extname(file.originalname ?? '').toLowerCase();
    const allowedMimes = ALLOWED_EXTENSIONS.get(ext);
    if (!allowedMimes) {
      throw new BadRequestException('Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif, webp)');
    }
    const mime = (file.mimetype ?? '').toLowerCase();
    if (!allowedMimes.has(mime)) {
      throw new BadRequestException(`Loại file không hợp lệ cho phần mở rộng ${ext}`);
    }

    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    return this.uploadStore.store(filename, file);
  }

  async storeImages(files: Express.Multer.File[]): Promise<string[]> {
    const max = this.config.get<number>('upload.maxFiles') ?? 10;
    if (!files?.length) throw new BadRequestException('Danh sách file không được để trống');
    if (files.length > max) {
      throw new BadRequestException(`Chỉ được tải lên tối đa ${max} file một lần`);
    }
    const urls: string[] = [];
    for (const file of files) {
      urls.push(await this.storeImage(file));
    }
    return urls;
  }

  async deleteByUrl(fileUrl: string): Promise<void> {
    if (!fileUrl) throw new BadRequestException('URL file không được để trống');
    const store = this.supabaseStore.owns(fileUrl) ? this.supabaseStore : this.localStore;
    await store.delete(fileUrl);
  }
}
