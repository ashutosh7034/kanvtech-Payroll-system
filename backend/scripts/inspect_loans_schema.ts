import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const loanCols: any = await prisma.$queryRawUnsafe(
      "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'EmployeeLoan' ORDER BY ordinal_position;"
    );
    console.log('EmployeeLoan columns:', loanCols);

    const typeCols: any = await prisma.$queryRawUnsafe(
      "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'LoanType' ORDER BY ordinal_position;"
    );
    console.log('LoanType columns:', typeCols);
  } finally {
    await prisma.$disconnect();
  }
}

main();
