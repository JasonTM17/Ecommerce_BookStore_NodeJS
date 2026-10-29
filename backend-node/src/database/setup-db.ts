import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AppConfig, config } from '../config/configuration';
import { buildDataSourceOptions } from './typeorm.config';

/**
 * One-shot schema setup for a NEW, empty database (e.g. a fresh Supabase
 * project). Checks emptiness before synchronizing — the runtime always
 * boots with its configured value, which must stay false in production.
 *
 *   DB_SETUP_CONFIRM_EMPTY=create-new-empty-schema npm run db:setup
 *
 * It only creates the schema; run `npm run seed` afterwards if demo data is
 * wanted on a disposable database.
 */
export async function setupEmptyDatabase(
  dataSource: DataSource,
  confirmation: string | undefined,
): Promise<void> {
  if (confirmation !== 'create-new-empty-schema') {
    throw new Error('Fresh schema setup requires DB_SETUP_CONFIRM_EMPTY=create-new-empty-schema');
  }
  if (dataSource.options.synchronize) {
    throw new Error('Refusing setup: synchronization must be disabled during the emptiness check');
  }
  await dataSource.initialize();
  try {
    const tables = dataSource.options.type === 'postgres'
      ? await dataSource.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
        )
      : await dataSource.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
        );
    if (tables.length !== 0) {
      throw new Error('Refusing schema setup: application database already contains tables; use reviewed migrations');
    }
    await dataSource.synchronize(false);
  } finally {
    await dataSource.destroy();
  }
}

async function main() {
  const setupConfig: AppConfig = {
    ...config,
    db: { ...config.db, synchronize: false },
  };
  const dataSource = new DataSource(buildDataSourceOptions(setupConfig));
  await setupEmptyDatabase(dataSource, process.env.DB_SETUP_CONFIRM_EMPTY);
  console.log(
    `[db:setup] schema synchronized on ${config.db.type}://${config.db.host}:${config.db.port}/${config.db.name}`,
  );
}

if (require.main === module) {
  void main().catch(() => {
    console.error('[db:setup] failed; verify the fresh-database confirmation and database configuration');
    process.exitCode = 1;
  });
}
