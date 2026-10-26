import { PrismaClient } from '@prisma/client';

const prismaProd = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:root@localhost:5432/payroll_management?schema=public' } }
});

const prismaTest = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:root@localhost:5432/payroll_management_test?schema=public' } }
});

async function main() {
  console.log('Testing safe non-destructive migration...');
  
  for (const [name, p] of [['TEST_DB', prismaTest], ['PROD_DB', prismaProd]] as const) {
    console.log(`Applying safely to ${name}...`);
    // 1. Add enum values safely
    await p.$executeRawUnsafe(`ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED';`);
    await p.$executeRawUnsafe(`ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'PAID';`);
    
    // 2. Add columns safely
    await p.$executeRawUnsafe(`ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "claimType" TEXT DEFAULT 'EXPENSE';`);
    await p.$executeRawUnsafe(`ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "resubmittedAt" TIMESTAMP(3);`);
    await p.$executeRawUnsafe(`ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "correctionNotes" TEXT;`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExpenseClaim_claimType_idx" ON "ExpenseClaim"("claimType");`);
  }

  // Verify protected loan in prod
  const loan = await prismaProd.employeeLoan.findUnique({
    where: { id: 'b405b4b8-1211-48c5-a59e-ee8db001a906' }
  });
  console.log('Protected loan status:', loan?.id, loan?.principalAmount, loan?.status);

  // Verify claims
  const claimsCount = await prismaProd.expenseClaim.count();
  console.log('Expense claims count in prod:', claimsCount);
}

main()
  .catch(console.error)
  .finally(() => {
    prismaProd.$disconnect();
    prismaTest.$disconnect();
  });
