import { DataSourceOptions } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { ALL_ENTITIES } from '../entities';

export function buildDataSourceOptions(config: AppConfig): DataSourceOptions {
  const common = {
    entities: ALL_ENTITIES,
    synchronize: config.db.synchronize,
    logging: config.db.logging,
  };

  if (config.db.type === 'mysql') {
    return {
      ...common,
      type: 'mysql',
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      username: config.db.username,
      password: config.db.password,
      charset: 'utf8mb4',
      ssl: config.db.ssl ? { rejectUnauthorized: true } : undefined,
      extra: {
        connectionLimit: config.db.poolMax,
        connectTimeout: config.db.poolConnectionTimeoutMs,
      },
    } as DataSourceOptions;
  }

  return {
    ...common,
    type: 'postgres',
    host: config.db.host,
    port: config.db.port,
    database: config.db.name,
    username: config.db.username,
    password: config.db.password,
    ssl: config.db.ssl || undefined,
    // Passed straight to pg.Pool: bounds connection growth per instance and
    // caps checkout wait, which keeps hosted functions inside a shared
    // pooler's (e.g. Supabase) session budget.
    extra: {
      max: config.db.poolMax,
      idleTimeoutMillis: config.db.poolIdleTimeoutMs,
      connectionTimeoutMillis: config.db.poolConnectionTimeoutMs,
    },
  } as DataSourceOptions;
}
