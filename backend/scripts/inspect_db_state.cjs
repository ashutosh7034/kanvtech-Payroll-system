const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

// Read .env.local and populate process.env
const envLocalPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[k] = v;
      }
    }
  });
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
    }
  }
});

async function inspect() {
  try {
    const migRows = await prisma.$queryRawUnsafe('SELECT id, checksum, finished_at, migration_name, rolled_back_at, started_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at ASC');
    console.log('=== _PRISMA_MIGRATIONS RECORD ===');
    console.log('Total migrations recorded:', migRows.length);
    migRows.forEach(r => {
      console.log(`- Migration: ${r.migration_name} | Finished: ${r.finished_at} | Steps: ${r.applied_steps_count}`);
    });

    const userCount = await prisma.user.count();
    const companyCount = await prisma.company.count();
    const roleCount = await prisma.role.count();
    const compCount = await prisma.salaryComponent.count();
    console.log('\n=== DATA INTEGRITY ===');
    console.log(`Company count: ${companyCount}`);
    console.log(`User count: ${userCount}`);
    console.log(`Role count: ${roleCount}`);
    console.log(`SalaryComponent count: ${compCount}`);

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
