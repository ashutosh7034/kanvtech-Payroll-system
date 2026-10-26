import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export function assertTestSafety(): void {
  if (process.env.NODE_ENV === 'test') {
    const url = process.env.DATABASE_URL || '';
    if (!url.includes('_test') && !url.includes('test') && !process.env.ALLOW_TEST_ON_PROD) {
      throw new Error(`[FATAL SAFETY GUARD] Refusing test operation on non-test database: ${url}`);
    }
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    assertTestSafety();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
