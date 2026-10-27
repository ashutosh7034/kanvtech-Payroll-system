import { PrismaClient } from '@prisma/client';

async function migrateDb(url: string, dbName: string) {
  console.log(`Applying leave enhancements migration to: ${dbName}...`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  const statements = [
    // 1. LeavePolicy columns
    `ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "minAdvanceNoticeDays" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "maxConsecutiveDays" INTEGER NOT NULL DEFAULT 30;`,
    `ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "allowHalfDay" BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "requiresAttachment" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "probationAllowed" BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "applicableGender" VARCHAR(20) NOT NULL DEFAULT 'ALL';`,
    `ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "accrualFrequency" VARCHAR(20) NOT NULL DEFAULT 'ANNUAL';`,
    `ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "description" TEXT;`,

    // 2. LeaveRequest columns
    `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "applicationNumber" VARCHAR(64);`,
    `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "halfDayPeriod" VARCHAR(20);`,
    `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;`,
    `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "isDraft" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "approverComment" TEXT;`,
    `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;`
  ];

  try {
    for (const sql of statements) {
      await prisma.$executeRawUnsafe(sql);
    }

    // Enum values for RequestStatus
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'DRAFT';`);
    } catch (e: any) {
      console.log('Notice on DRAFT enum value:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';`);
    } catch (e: any) {
      console.log('Notice on WITHDRAWN enum value:', e.message);
    }

    console.log(`Migration successful on ${dbName}`);
  } catch (err) {
    console.error(`Migration error on ${dbName}:`, err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const mainUrl = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/payroll_management?schema=public';
  const testUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:root@localhost:5432/payroll_management_test?schema=public';

  await migrateDb(mainUrl, 'MAIN DATABASE [payroll_management]');
  await migrateDb(testUrl, 'TEST DATABASE [payroll_management_test]');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
