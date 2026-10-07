const { execSync } = require('child_process');
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('No DATABASE_URL found');
  process.exit(1);
}
let directUrl = dbUrl;
if (dbUrl.includes('-pooler')) {
  directUrl = dbUrl.replace('-pooler', '');
}
if (directUrl.includes('pgbouncer=true')) {
  directUrl = directUrl.replace('pgbouncer=true', '');
  directUrl = directUrl.replace('?&', '?').replace('&&', '&');
  if (directUrl.endsWith('?')) directUrl = directUrl.slice(0, -1);
}
console.log('Running prisma migrate deploy with derived direct URL...');
try {
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: directUrl }, stdio: 'inherit' });
} catch (e) {
  process.exit(1);
}
