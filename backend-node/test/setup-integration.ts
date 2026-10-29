/**
 * Integration-test environment bootstrap. Applies the env file emitted by
 * `npm run docker:db:up` (scripts/.test-db-env) to process.env before any
 * application module reads it. Missing file → tests fail with a clear hint.
 */
import * as fs from 'fs';
import * as path from 'path';

const envFile = path.resolve(__dirname, '..', 'scripts', '.test-db-env');

if (!fs.existsSync(envFile)) {
  throw new Error(
    'scripts/.test-db-env not found. Run `npm run docker:db:up` before `npm run test:integration`.',
  );
}

for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (!(key in process.env)) process.env[key] = value;
}

// Integration runs should never trip rate limits or require production gates.
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_ENABLED = 'false';
