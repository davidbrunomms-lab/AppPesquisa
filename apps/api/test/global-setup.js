const { execSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

/** Cria um schema exclusivo para esta execução, aplica as migrações e o seed básico. */
module.exports = async () => {
  const schema = `e2e_${Date.now()}`;
  writeFileSync(join(tmpdir(), 'personalpro-e2e-schema'), schema);
  process.env.E2E_SCHEMA = schema;
  require('./setup-env');
  const env = { ...process.env, SEED_DEMO: 'false' };
  const cwd = join(__dirname, '..');
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'inherit' });
  execSync('npx ts-node --transpile-only prisma/seed.ts', { cwd, env, stdio: 'inherit' });
};
