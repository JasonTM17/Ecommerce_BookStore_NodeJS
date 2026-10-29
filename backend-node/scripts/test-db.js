#!/usr/bin/env node
/**
 * Isolated Postgres test container management.
 *
 * - Container name: bookstore-node-test-db (unique `bookstore-node` prefix)
 * - Dynamic host port: picks a free port via a probe listen, writes it to
 *   scripts/.test-db-env so tests can source DB_HOST/DB_PORT/DB_NAME.
 * - `up` starts (or reuses) the container and waits for readiness.
 * - `down` removes the container.
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const NAME = 'bookstore-node-test-db';
const IMAGE = 'postgres:16-alpine';
const DB = 'bookstore_test';
const USER = 'bookstore';
const PASS = 'bookstore_test_pw';
const ENV_FILE = path.join(__dirname, '.test-db-env');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function up() {
  const existing = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', NAME], {
    encoding: 'utf8',
  });
  if (existing.status === 0 && existing.stdout.trim() === 'true') {
    console.log(`[test-db] ${NAME} already running`);
    printEnv();
    return;
  }
  if (existing.status === 0) {
    sh(`docker rm -f ${NAME}`);
  }

  const port = await freePort();
  sh(
    `docker run -d --name ${NAME} ` +
      `-e POSTGRES_DB=${DB} -e POSTGRES_USER=${USER} -e POSTGRES_PASSWORD=${PASS} ` +
      `-p 127.0.0.1:${port}:5432 ${IMAGE}`,
  );

  for (let i = 0; i < 60; i++) {
    const ready = spawnSync(
      'docker',
      ['exec', NAME, 'pg_isready', '-U', USER, '-d', DB],
      { encoding: 'utf8' },
    );
    if (ready.status === 0) break;
    if (i === 59) throw new Error('Postgres did not become ready in time');
    await new Promise((r) => setTimeout(r, 1000));
  }

  fs.writeFileSync(
    ENV_FILE,
    [
      `DB_TYPE=postgres`,
      `DB_HOST=127.0.0.1`,
      `DB_PORT=${port}`,
      `DB_NAME=${DB}`,
      `DB_USERNAME=${USER}`,
      `DB_PASSWORD=${PASS}`,
      `DB_SYNCHRONIZE=true`,
      `NODE_ENV=test`,
      `JWT_SECRET=test-only-jwt-secret-key-for-integration-tests-0123456789`,
      ``,
    ].join('\n'),
  );
  console.log(`[test-db] ${NAME} ready on 127.0.0.1:${port}`);
  printEnv();
}

function down() {
  try {
    sh(`docker rm -f ${NAME}`);
    console.log(`[test-db] ${NAME} removed`);
  } catch {
    console.log(`[test-db] ${NAME} not present`);
  }
  if (fs.existsSync(ENV_FILE)) fs.unlinkSync(ENV_FILE);
}

function printEnv() {
  if (fs.existsSync(ENV_FILE)) {
    console.log(fs.readFileSync(ENV_FILE, 'utf8'));
  }
}

const cmd = process.argv[2];
if (cmd === 'up') up().catch((e) => { console.error(e); process.exit(1); });
else if (cmd === 'down') down();
else if (cmd === 'env') printEnv();
else {
  console.error('usage: test-db.js up|down|env');
  process.exit(1);
}
