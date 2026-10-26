const path = require('path');
require(path.resolve(__dirname, '../../../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../../backend/.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../../../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ 
    select: { 
      id: true, 
      email: true, 
      fullName: true, 
      active: true, 
      userRoles: { select: { role: { select: { name: true } } } } 
    } 
  });
  console.log('Registered Users:', users);
  await prisma.$disconnect();
}
main();
