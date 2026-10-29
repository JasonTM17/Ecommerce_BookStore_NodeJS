import type { DataSource } from 'typeorm';
import { setupEmptyDatabase } from './setup-db';

function database(tables: unknown[] = [], synchronize = false) {
  return {
    options: { type: 'postgres', synchronize },
    initialize: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(tables),
    synchronize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

describe('explicit empty database setup', () => {
  it('requires confirmation before connecting', async () => {
    const db = database();
    await expect(setupEmptyDatabase(db as unknown as DataSource, undefined)).rejects.toThrow('DB_SETUP_CONFIRM_EMPTY');
    expect(db.initialize).not.toHaveBeenCalled();
  });

  it('refuses an existing application table without modifying the schema', async () => {
    const db = database([{ table_name: 'users' }]);
    await expect(setupEmptyDatabase(db as unknown as DataSource, 'create-new-empty-schema')).rejects.toThrow('already contains tables');
    expect(db.synchronize).not.toHaveBeenCalled();
    expect(db.destroy).toHaveBeenCalledTimes(1);
  });

  it('creates only after checking the empty application schema', async () => {
    const db = database();
    await setupEmptyDatabase(db as unknown as DataSource, 'create-new-empty-schema');
    expect(db.query.mock.invocationCallOrder[0]).toBeLessThan(db.synchronize.mock.invocationCallOrder[0]);
    expect(db.synchronize).toHaveBeenCalledWith(false);
    expect(db.destroy).toHaveBeenCalledTimes(1);
  });

  it('blocks automatic synchronization during initialization', async () => {
    const db = database([], true);
    await expect(setupEmptyDatabase(db as unknown as DataSource, 'create-new-empty-schema')).rejects.toThrow('disabled');
    expect(db.initialize).not.toHaveBeenCalled();
  });
});
