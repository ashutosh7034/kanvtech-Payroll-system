const path = require('path');
require(path.resolve(__dirname, '../../../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../../backend/.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../../../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.salaryComponent.findMany({
    where: { code: { contains: 'TEST_COMP' } },
    include: { _count: { select: { templateLines: true, structureLines: true } } }
  });
  console.log('TEST_COMP records count:', records.length);
  if (records.length > 0) {
    console.log(JSON.stringify(records, null, 2));
  } else {
    console.log('No TEST_COMP_ records found in the database.');
  }
  await prisma.$disconnect();
}
main();
