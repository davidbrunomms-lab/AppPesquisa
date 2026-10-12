// Ambiente dos testes e2e. Cada execução usa um schema PostgreSQL próprio
// (criado em global-setup via `migrate deploy` e removido em global-teardown).
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const SCHEMA_FILE = join(tmpdir(), 'personalpro-e2e-schema');
const baseUrl = process.env.TEST_DATABASE_URL || 'postgresql://personalpro:personalpro@localhost:5432/personalpro_test';
const schema = process.env.E2E_SCHEMA || (existsSync(SCHEMA_FILE) ? readFileSync(SCHEMA_FILE, 'utf8').trim() : 'public');

process.env.TZ = 'America/Sao_Paulo';
process.env.DATABASE_URL = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}schema=${schema}`;
process.env.JWT_ACCESS_SECRET = 'test-secret-with-more-than-32-characters!!';
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.STORAGE_LOCAL_DIR = join(tmpdir(), 'personalpro-test-uploads');
process.env.NODE_ENV = 'test';

module.exports = { SCHEMA_FILE };
