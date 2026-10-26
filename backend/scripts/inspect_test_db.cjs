const { PrismaClient } = require('@prisma/client');
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:root@localhost:5432/payroll_management_test?schema=public'
    }
  }
});

async function main() {
  try {
    const employees = await testPrisma.employee.findMany();
    console.log('Employees in payroll_management_test:', employees.length);
    const tables = await testPrisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables in payroll_management_test:', tables.map(t => t.table_name));
  } catch (err) {
    console.error('Error inspecting test db:', err.message);
  }
}

main().finally(() => testPrisma.$disconnect());
