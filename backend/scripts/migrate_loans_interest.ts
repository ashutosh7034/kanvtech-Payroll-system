import { PrismaClient } from '@prisma/client';

async function migrateDb(url: string, dbName: string) {
  console.log(`\n--- Applying Loan Enhancement Migration to [${dbName}] ---`);
  const prisma = new PrismaClient({
    datasources: { db: { url } }
  });

  try {
    // 1. Add columns to LoanType
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "LoanType" 
      ADD COLUMN IF NOT EXISTS "interestType" VARCHAR(50) NOT NULL DEFAULT 'INTEREST_FREE',
      ADD COLUMN IF NOT EXISTS "interestMethod" VARCHAR(50) NOT NULL DEFAULT 'FLAT_RATE',
      ADD COLUMN IF NOT EXISTS "minInterestRatePct" NUMERIC(5, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "maxInterestRatePct" NUMERIC(5, 2) NOT NULL DEFAULT 36,
      ADD COLUMN IF NOT EXISTS "allowRateOverride" BOOLEAN NOT NULL DEFAULT true;
    `);
    console.log(`✓ LoanType columns ensured on [${dbName}]`);

    // 2. Add columns to EmployeeLoan
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "EmployeeLoan" 
      ADD COLUMN IF NOT EXISTS "interestType" VARCHAR(50) NOT NULL DEFAULT 'INTEREST_FREE',
      ADD COLUMN IF NOT EXISTS "interestRatePct" NUMERIC(5, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "interestMethod" VARCHAR(50) NOT NULL DEFAULT 'FLAT_RATE',
      ADD COLUMN IF NOT EXISTS "totalInterest" NUMERIC(18, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "totalRepayment" NUMERIC(18, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "sanctionOrderNumber" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "repaymentFrequency" VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
      ADD COLUMN IF NOT EXISTS "interestStartDate" TIMESTAMP WITHOUT TIME ZONE;
    `);
    console.log(`✓ EmployeeLoan columns ensured on [${dbName}]`);

    // 3. Populate default totalRepayment = principalAmount for historical loans if 0
    await prisma.$executeRawUnsafe(`
      UPDATE "EmployeeLoan" 
      SET "totalRepayment" = "principalAmount" 
      WHERE "totalRepayment" = 0 OR "totalRepayment" IS NULL;
    `);
    console.log(`✓ Historical loans totalRepayment backfilled safely on [${dbName}]`);

    // Verify protected loan integrity
    const protectedLoan = await prisma.employeeLoan.findUnique({
      where: { id: 'b405b4b8-1211-48c5-a59e-ee8db001a906' }
    });
    if (protectedLoan) {
      console.log(`✓ Protected Loan verified intact on [${dbName}]: ID=${protectedLoan.id}, Principal=${protectedLoan.principalAmount}, Status=${protectedLoan.status}`);
    }
  } catch (err) {
    console.error(`Error migrating [${dbName}]:`, err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const localMainUrl = 'postgresql://postgres:root@localhost:5432/payroll_management?schema=public';
  const testUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:root@localhost:5432/payroll_management_test?schema=public';

  await migrateDb(localMainUrl, 'LOCAL_MAIN_DATABASE');
  await migrateDb(testUrl, 'TEST_DATABASE');
  console.log('\n✓ Loan Enhancement Migration successfully applied to all databases.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
