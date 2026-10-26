const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envLocalPath = path.resolve(__dirname, '../../.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf8');

let directUrl = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL_UNPOOLED=')) {
    directUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  }
}

try {
  console.log('Comparing backend/prisma/schema.prisma to Live Neon PostgreSQL DB...');
  const output = execSync(
    `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-url "${directUrl}"`,
    {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );
  console.log('--- DIFF OUTPUT ---');
  console.log(output || 'No differences found! The schema and database are 100% in sync.');
} catch (err) {
  console.log('--- DIFF OUTPUT (Differences or Error) ---');
  console.log(err.stdout || '');
  console.error(err.stderr || '');
  console.log('Exit status:', err.status);
}
