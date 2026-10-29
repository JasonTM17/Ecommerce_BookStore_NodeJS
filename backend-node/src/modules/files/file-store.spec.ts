import { ServiceUnavailableException } from '@nestjs/common';
import { BadRequestException } from '../../common/exceptions';
import { SupabaseFileStore } from './file-store';

/**
 * Supabase Storage driver unit coverage. Real Supabase round-trips are
 * NOT_RUN (no hosted credentials in tests) — this spec pins the local
 * contract: honest failure when unconfigured, and URL ownership routing.
 */
describe('SupabaseFileStore', () => {
  const file = { buffer: Buffer.from('x'), mimetype: 'image/png' } as Express.Multer.File;

  it('never fabricates an upload URL when unconfigured', async () => {
    const store = new SupabaseFileStore('', '', 'uploads');
    await expect(store.store('a.png', file)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('owns() only matches its own public bucket URLs', () => {
    const store = new SupabaseFileStore('https://proj.supabase.co', 'key', 'uploads');
    expect(store.owns('https://proj.supabase.co/storage/v1/object/public/uploads/a.png')).toBe(true);
    expect(store.owns('/api/uploads/a.png')).toBe(false);
    expect(store.owns('https://other.supabase.co/storage/v1/object/public/uploads/a.png')).toBe(false);
    expect(store.owns('https://proj.supabase.co/storage/v1/object/public/other/a.png')).toBe(false);
  });

  it('rejects deleting URLs it does not own', async () => {
    const store = new SupabaseFileStore('https://proj.supabase.co', 'key', 'uploads');
    await expect(store.delete('/api/uploads/a.png')).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      store.delete('https://proj.supabase.co/storage/v1/object/public/uploads/../../x'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose provider response details on an upload failure', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private provider diagnostic', { status: 403 }));
    try {
      const store = new SupabaseFileStore('https://proj.supabase.co', 'test-placeholder', 'uploads');
      await expect(store.store('a.png', file)).rejects.toThrow('storage 403');
      await expect(store.store('b.png', file)).rejects.not.toThrow('private provider diagnostic');
    } finally {
      fetchMock.mockRestore();
    }
  });
});
