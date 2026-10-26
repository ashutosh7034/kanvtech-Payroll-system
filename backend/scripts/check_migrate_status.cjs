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
  const out = execSync('npx prisma migrate status', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: directUrl, DATABASE_URL_UNPOOLED: directUrl },
    encoding: 'utf8'
  });
  console.log('--- PRISMA MIGRATE STATUS ---');
  console.log(out);
} catch (e) {
  console.log('--- PRISMA MIGRATE STATUS ERROR ---');
  console.log(e.stdout || e.message);
}
