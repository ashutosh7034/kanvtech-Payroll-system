import dotenv from 'dotenv';
import path from 'path';

// Load .env.test explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Explicit Production Database Safety Guard
const dbUrl = process.env.DATABASE_URL || '';
const isTestDb = dbUrl.includes('_test') || dbUrl.includes('test');

if (!isTestDb && !process.env.ALLOW_TEST_ON_PROD) {
  const fatalMsg = `
==================================================================================
[FATAL SAFETY GUARD VIOLATION] Test execution blocked!
Attempted to run test suite against non-test database:
DATABASE_URL: "${dbUrl}"

Automated test execution is STRICTLY RESTRICTED to dedicated test databases
(e.g., payroll_management_test).
Do NOT run tests against development or production databases.
==================================================================================
`;
  console.error(fatalMsg);
  throw new Error(fatalMsg);
}

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test';
