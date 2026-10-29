import { ServiceUnavailableException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException } from '../../common/exceptions';

/**
 * Persistence backends for uploaded images. The HTTP contract is identical
 * for both drivers: store() returns a public asset URL and delete() removes
 * the object behind that URL.
 */
export interface FileStore {
  /** Stores the file under the given object name; returns its public URL. */
  store(filename: string, file: Express.Multer.File): Promise<string>;
  /** True when this store produced/can serve the given URL. */
  owns(fileUrl: string): boolean;
  /** Deletes the object behind a URL previously returned by store(). */
  delete(fileUrl: string): Promise<void>;
}

/** Local filesystem store (development): files land in UPLOAD_DIR and are
 *  served by the /api/uploads static handler. */
export class LocalFileStore implements FileStore {
  constructor(
    private readonly uploadDir: string,
    private readonly baseUrl: string,
  ) {}

  async store(filename: string, file: Express.Multer.File): Promise<string> {
    const dir = this.uploadDir;
    await fs.promises.mkdir(dir, { recursive: true });
    const target = path.resolve(dir, filename);
    // Paranoia: never write outside the uploads dir.
    if (!target.startsWith(dir + path.sep)) {
      throw new BadRequestException('Tên file không hợp lệ');
    }
    await fs.promises.writeFile(target, file.buffer);
    return `${this.baseUrl}/${filename}`;
  }

  owns(): boolean {
    return true; // fallback store — accepts bare filenames and /uploads URLs
  }

  async delete(fileUrl: string): Promise<void> {
    const marker = '/uploads/';
    const idx = fileUrl.indexOf(marker);
    const filename = idx >= 0 ? fileUrl.substring(idx + marker.length) : fileUrl;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('URL file không hợp lệ');
    }
    const target = path.resolve(this.uploadDir, filename);
    if (!target.startsWith(this.uploadDir + path.sep)) {
      throw new BadRequestException('URL file không hợp lệ');
    }
    try {
      await fs.promises.unlink(target);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e;
    }
  }
}

/**
 * Supabase Storage store over the plain HTTPS object API — no extra runtime
 * dependency. Objects go to a PUBLIC bucket under flat names; the returned
 * URL is the bucket's /object/public/ path. The service-role key is used only
 * inside this server-side store and is never exposed to clients.
 */
export class SupabaseFileStore implements FileStore {
  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
    private readonly bucket: string,
  ) {}

  private assertConfigured(): void {
    if (!this.supabaseUrl || !this.serviceRoleKey || !this.bucket) {
      // Honest failure — never fake an upload URL when storage is unconfigured.
      throw new ServiceUnavailableException(
        'Supabase storage chưa được cấu hình (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_STORAGE_BUCKET)',
      );
    }
  }

  private get publicPrefix(): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/`;
  }

  private objectEndpoint(objectName: string): string {
    return `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${objectName}`;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      authorization: `Bearer ${this.serviceRoleKey}`,
      apikey: this.serviceRoleKey,
      ...extra,
    };
  }

  async store(filename: string, file: Express.Multer.File): Promise<string> {
    this.assertConfigured();
    const res = await fetch(this.objectEndpoint(filename), {
      method: 'POST',
      headers: this.headers({
        'content-type': file.mimetype || 'application/octet-stream',
        'x-upsert': 'false',
      }),
      body: file.buffer,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new BadRequestException(
        `Tải ảnh lên thất bại (storage ${res.status})`,
      );
    }
    return `${this.publicPrefix}${filename}`;
  }

  owns(fileUrl: string): boolean {
    return !!this.supabaseUrl && !!this.bucket && fileUrl.startsWith(this.publicPrefix);
  }

  async delete(fileUrl: string): Promise<void> {
    this.assertConfigured();
    if (!this.owns(fileUrl)) {
      throw new BadRequestException('URL file không hợp lệ');
    }
    const objectName = fileUrl.substring(this.publicPrefix.length);
    if (!objectName || objectName.includes('..')) {
      throw new BadRequestException('URL file không hợp lệ');
    }
    const res = await fetch(this.objectEndpoint(objectName), {
      method: 'DELETE',
      headers: this.headers(),
      signal: AbortSignal.timeout(15_000),
    });
    // Missing object is already gone — treat 404 like a successful delete.
    if (!res.ok && res.status !== 404) {
      throw new BadRequestException(`Xóa ảnh thất bại (storage ${res.status})`);
    }
  }
}
