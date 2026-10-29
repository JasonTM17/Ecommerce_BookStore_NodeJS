import * as dotenv from 'dotenv';
import * as path from 'path';

// Load the repo-root .env first (shared with other runtimes), then a local
// backend-node/.env override. Neither file is required.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

export type DatabaseType = 'postgres' | 'mysql';

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  appBaseUrl: string;
  corsOrigins: string[];

  db: {
    type: DatabaseType;
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
    synchronize: boolean;
    logging: boolean;
    ssl: boolean | { rejectUnauthorized: boolean; ca?: string };
    poolMax: number;
    poolIdleTimeoutMs: number;
    poolConnectionTimeoutMs: number;
  };

  jwt: {
    secret: string;
    expirationMs: number;
    refreshExpirationMs: number;
  };

  upload: {
    dir: string;
    baseUrl: string;
    maxFileSize: number;
    maxFiles: number;
  };

  storage: {
    driver: 'local' | 'supabase';
    supabaseUrl: string;
    serviceRoleKey: string;
    bucket: string;
  };

  mail: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
    from: string;
    testEndpointsEnabled: boolean;
    allowedTestRecipients: string[];
  };

  grok: {
    enabled: boolean;
    apiKey: string;
    apiUrl: string;
    model: string;
    maxContextMessages: number;
  };

  vnpay: {
    url: string;
    merchantId: string;
    merchantKey: string;
    returnUrl: string;
    ipnUrl: string;
  };

  rateLimit: {
    enabled: boolean;
    authLimit: number;
    authWindowMs: number;
    apiLimit: number;
    apiWindowMs: number;
    publicLimit: number;
    publicWindowMs: number;
  };

  seed: {
    enabled: boolean;
    adminPassword: string;
    managerPassword: string;
    customerPassword: string;
  };
}

const REJECTED_SECRET_FRAGMENTS = [
  'yoursupersecretkeyforjwttokengeneration',
  'secret_key_here',
  'replace-with',
  'changeme',
  'please-change',
  'placeholder',
  'example-secret',
];

function parseDbType(raw: string | undefined): DatabaseType {
  const value = (raw || 'postgres').trim().toLowerCase();
  if (value === 'postgres' || value === 'postgresql' || value === 'pg') return 'postgres';
  if (value === 'mysql' || value === 'mariadb') return 'mysql';
  throw new Error(`Unsupported DB_TYPE "${raw}". Use "postgres" or "mysql".`);
}

function parseStorageDriver(raw: string | undefined): 'local' | 'supabase' {
  const value = (raw || 'local').trim().toLowerCase();
  if (value === 'local' || value === 'supabase') return value;
  throw new Error(`Unsupported STORAGE_DRIVER "${raw}". Use "local" or "supabase".`);
}

interface ParsedDatabaseUrl {
  type: DatabaseType;
  host: string;
  port: number;
  name: string;
  username: string;
  password: string;
  ssl: boolean;
}

/**
 * Parses a DATABASE_URL (e.g. Supabase pooled
 * postgresql://user:pass@host:6543/db?sslmode=require). Returns null when the
 * URL is absent or not a supported database protocol.
 */
function parseDatabaseUrl(raw: string | undefined): ParsedDatabaseUrl | null {
  if (!raw?.trim()) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL');
  }
  const protocol = url.protocol.replace(':', '').toLowerCase();
  const type: DatabaseType =
    protocol === 'postgres' || protocol === 'postgresql'
      ? 'postgres'
      : protocol === 'mysql'
        ? 'mysql'
        : (() => {
            throw new Error(`Unsupported DATABASE_URL protocol "${url.protocol}"`);
          })();
  const sslmode = (url.searchParams.get('sslmode') || '').toLowerCase();
  return {
    type,
    host: url.hostname,
    port: Number(url.port) || (type === 'postgres' ? 5432 : 3306),
    name: decodeURIComponent(url.pathname.replace(/^\//, '')),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: sslmode !== '' && sslmode !== 'disable',
  };
}

function assertJwtSecret(secret: string): void {
  if (!secret || secret.includes('${')) {
    throw new Error('JWT_SECRET must be configured with a real secret value.');
  }
  const normalized = secret.trim().toLowerCase();
  if (REJECTED_SECRET_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    throw new Error('JWT_SECRET must not use a public placeholder value.');
  }
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be at least 32 bytes for HS256 signing.');
  }
}

export function loadConfig(overrides: Partial<Record<string, string>> = {}): AppConfig {
  const env = (key: string): string | undefined =>
    overrides[key] !== undefined ? overrides[key] : process.env[key];

  const nodeEnv = (env('NODE_ENV') || 'development').trim().toLowerCase();
  const isProduction = nodeEnv === 'production' || nodeEnv === 'prod';
  const databaseUrl = parseDatabaseUrl(env('DATABASE_URL'));
  // Explicit DB_TYPE wins; otherwise DATABASE_URL decides, default postgres.
  const dbType = env('DB_TYPE')
    ? parseDbType(env('DB_TYPE'))
    : databaseUrl?.type ?? parseDbType(undefined);

  const jwtSecret = env('JWT_SECRET') || '';
  if (isProduction) {
    // Fail closed in production: never boot with a missing/weak JWT secret.
    assertJwtSecret(jwtSecret);
  }

  const corsRaw = env('CORS_ORIGINS') || 'http://localhost:3000,http://localhost:3001';
  const corsOrigins = corsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (isProduction && (corsOrigins.length === 0 || corsOrigins.includes('*'))) {
    throw new Error('CORS_ORIGINS must name explicit origins in production (no wildcard).');
  }

  const defaultDbPort = dbType === 'postgres' ? 5432 : 3306;

  // DATABASE_URL fields override their DB_* counterparts when present.
  const dbHost = databaseUrl?.host ?? env('DB_HOST') ?? 'localhost';
  const dbPort = Number(databaseUrl?.port ?? env('DB_PORT') ?? defaultDbPort);
  const dbName = databaseUrl?.name ?? env('DB_NAME') ?? 'bookstore';
  const dbUsername = databaseUrl?.username ?? env('DB_USERNAME') ?? 'bookstore';
  const dbPassword = databaseUrl?.password ?? env('DB_PASSWORD') ?? 'bookstore123';
  const dbSsl =
    env('DB_SSL') === 'true' || (env('DB_SSL') === undefined && databaseUrl?.ssl === true)
      ? {
          rejectUnauthorized: env('DB_SSL_REJECT_UNAUTHORIZED') !== 'false',
          ...(env('DB_SSL_CA')?.trim()
            ? { ca: env('DB_SSL_CA')!.replace(/\\n/g, '\n') }
            : {}),
        }
      : false;

  // Schema sync is dev/test convenience only: it must be enabled explicitly
  // in production, and the default there is always off.
  const synchronizeRaw = env('DB_SYNCHRONIZE');
  const dbSynchronize =
    synchronizeRaw === undefined ? !isProduction : synchronizeRaw === 'true';

  return {
    nodeEnv,
    isProduction,
    port: Number(env('PORT') || 8080),
    apiPrefix: 'api',
    appBaseUrl: env('APP_BASE_URL') || 'http://localhost:3000',
    corsOrigins,

    db: {
      type: dbType,
      host: dbHost,
      port: dbPort,
      name: dbName,
      username: dbUsername,
      password: dbPassword,
      synchronize: dbSynchronize,
      logging: env('DB_LOGGING') === 'true',
      ssl: dbSsl,
      // Bounded pool: small by default so hosted functions never exhaust a
      // shared pooler; raise DB_POOL_MAX only for a dedicated direct DB.
      poolMax: Number(env('DB_POOL_MAX') || 5),
      poolIdleTimeoutMs: Number(env('DB_POOL_IDLE_TIMEOUT_MS') || 10000),
      poolConnectionTimeoutMs: Number(env('DB_POOL_CONNECTION_TIMEOUT_MS') || 10000),
    },

    jwt: {
      secret: jwtSecret || 'dev-only-insecure-jwt-secret-do-not-use-in-prod-0123456789',
      expirationMs: Number(env('JWT_EXPIRATION') || 86400000),
      refreshExpirationMs: Number(env('JWT_REFRESH_EXPIRATION') || 604800000),
    },

    upload: {
      dir: env('UPLOAD_DIR') || 'uploads',
      baseUrl: `${env('APP_BASE_URL') || 'http://localhost:8080'}/api/uploads`,
      maxFileSize: Number(env('UPLOAD_MAX_FILE_SIZE') || 10 * 1024 * 1024),
      maxFiles: Number(env('UPLOAD_MAX_FILES') || 10),
    },

    storage: {
      driver: parseStorageDriver(env('STORAGE_DRIVER')),
      supabaseUrl: (env('SUPABASE_URL') || '').replace(/\/$/, ''),
      serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY') || '',
      bucket: env('SUPABASE_STORAGE_BUCKET') || 'uploads',
    },

    mail: {
      enabled: !!(env('MAIL_HOST') && env('MAIL_USERNAME') && env('MAIL_PASSWORD')),
      host: env('MAIL_HOST') || 'smtp.gmail.com',
      port: Number(env('MAIL_PORT') || 587),
      username: env('MAIL_USERNAME') || '',
      password: env('MAIL_PASSWORD') || '',
      from: env('MAIL_FROM') || env('MAIL_USERNAME') || 'noreply@bookstore.com',
      testEndpointsEnabled: env('APP_EMAIL_TEST_ENABLED') === 'true',
      allowedTestRecipients: (env('APP_EMAIL_ALLOWED_RECIPIENTS') || '')
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .filter((r) => r.length > 0),
    },

    grok: {
      enabled: env('GROK_ENABLED') === 'true' && !!env('GROK_API_KEY'),
      apiKey: env('GROK_API_KEY') || '',
      apiUrl: env('GROK_API_URL') || 'https://api.x.ai/v1/chat/completions',
      model: env('GROK_MODEL') || 'grok-3',
      maxContextMessages: Number(env('GROK_MAX_CONTEXT_MESSAGES') || 10),
    },

    vnpay: {
      url: env('VNPAY_URL') || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      merchantId: env('VNPAY_MERCHANT_ID') || '',
      merchantKey: env('VNPAY_MERCHANT_KEY') || '',
      returnUrl: env('VNPAY_RETURN_URL') || 'http://localhost:3001/payment/return',
      ipnUrl: env('VNPAY_IPN_URL') || 'http://localhost:8080/api/payments/vnpay/ipn',
    },

    rateLimit: {
      enabled: (env('RATE_LIMIT_ENABLED') || 'true') === 'true',
      authLimit: Number(env('RATE_LIMIT_AUTH_LIMIT') || 5),
      authWindowMs: Number(env('RATE_LIMIT_AUTH_WINDOW_MS') || 60000),
      apiLimit: Number(env('RATE_LIMIT_API_LIMIT') || 100),
      apiWindowMs: Number(env('RATE_LIMIT_API_WINDOW_MS') || 60000),
      publicLimit: Number(env('RATE_LIMIT_PUBLIC_LIMIT') || 200),
      publicWindowMs: Number(env('RATE_LIMIT_PUBLIC_WINDOW_MS') || 60000),
    },

    seed: {
      enabled: env('APP_DEMO_SEED_ENABLED') === 'true',
      adminPassword: env('APP_DEMO_ADMIN_PASSWORD') || '',
      managerPassword: env('APP_DEMO_MANAGER_PASSWORD') || '',
      customerPassword: env('APP_DEMO_CUSTOMER_PASSWORD') || '',
    },
  };
}

export const config: AppConfig = loadConfig();
