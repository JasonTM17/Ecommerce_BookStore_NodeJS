import { loadConfig } from './configuration';

describe('managed Postgres certificate verification', () => {
  it('keeps verification enabled when a provider CA is configured', () => {
    const config = loadConfig({ NODE_ENV: 'test', DB_SSL: 'true', DB_SSL_REJECT_UNAUTHORIZED: 'true', DB_SSL_CA: 'public-ca\\ncertificate' });
    expect(config.db.ssl).toEqual({ rejectUnauthorized: true, ca: 'public-ca\ncertificate' });
  });

  it('does not weaken TLS when the CA is absent', () => {
    const config = loadConfig({ NODE_ENV: 'test', DB_SSL: 'true', DB_SSL_REJECT_UNAUTHORIZED: 'true', DB_SSL_CA: '' });
    expect(config.db.ssl).toEqual({ rejectUnauthorized: true });
  });
});
