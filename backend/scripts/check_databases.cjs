const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dbs = await prisma.$queryRawUnsafe('SELECT datname FROM pg_database WHERE datistemplate = false;');
  console.log('Databases:', dbs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
