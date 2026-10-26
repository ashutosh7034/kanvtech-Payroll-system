import { PrismaClient } from '@prisma/client';

async function main() {
  console.log('--- Database Safety & Isolation Verification ---');
  
  // 1. Check Main DB
  const mainPrisma = new PrismaClient({
    datasources: {
      db: { url: 'postgresql://postgres:root@localhost:5432/payroll_management?schema=public' }
    }
  });

  try {
    const loan = await mainPrisma.employeeLoan.findUnique({
      where: { id: 'b405b4b8-1211-48c5-a59e-ee8db001a906' }
    });

    console.log('MAIN DATABASE [payroll_management]:');
    if (loan) {
      console.log(`Protected Loan Verified: ID=${loan.id}, Principal=${loan.principalAmount}, Status=${loan.status}`);
    } else {
      console.log('Protected Loan NOT FOUND in main database!');
    }
  } catch (err) {
    console.error('Error querying main database:', err);
  } finally {
    await mainPrisma.$disconnect();
  }

  // 2. Check Test DB
  const testPrisma = new PrismaClient({
    datasources: {
      db: { url: 'postgresql://postgres:root@localhost:5432/payroll_management_test?schema=public' }
    }
  });

  try {
    const count = await testPrisma.employeeLoan.count();
    console.log(`TEST DATABASE [payroll_management_test]: Total Loans = ${count}`);
    const loanInTest = await testPrisma.employeeLoan.findUnique({
      where: { id: 'b405b4b8-1211-48c5-a59e-ee8db001a906' }
    });
    console.log(`Protected Loan present in Test DB: ${!!loanInTest}`);
  } catch (err) {
    console.error('Error querying test database:', err);
  } finally {
    await testPrisma.$disconnect();
  }
}

main();
