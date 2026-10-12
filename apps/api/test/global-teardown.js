const { PrismaClient } = require('@prisma/client');

/** Remove apenas o schema criado por esta execução (e2e_<timestamp>). */
module.exports = async () => {
  const schema = process.env.E2E_SCHEMA;
  if (!schema || !/^e2e_\d+$/.test(schema)) return;
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
};
