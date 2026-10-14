import 'dotenv/config';

export const ENV = {
  PORT: Number(process.env.PORT ?? 4000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:root@localhost:5432/payroll_management?schema=public',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-insecure-secret-key-change-in-production-payroll-system-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '12h',
};
