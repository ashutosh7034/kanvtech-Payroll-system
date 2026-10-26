const path = require('path');
require(path.resolve(__dirname, '../../../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../../backend/.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../../../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  const comps = await prisma.salaryComponent.findMany({
    where: { companyId: company.id },
    select: { id: true, code: true, name: true, type: true, category: true, isTaxable: true, isPfGross: true }
  });
  console.log(`Found ${comps.length} components for company: ${company.name}`);
  console.log(comps);
  await prisma.$disconnect();
}
main();
