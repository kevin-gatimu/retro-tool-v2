import { execSync } from 'child_process';
import { resolve } from 'path';
import { config } from 'dotenv';

const envFlag = process.argv.find((arg) => arg === '--env');
const envIndex = process.argv.indexOf('--env');
const envFile = envIndex !== -1 ? process.argv[envIndex + 1] : '.env';

config({ path: resolve(process.cwd(), envFile) });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not set. Check your env file.');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
const envName = envFile.includes('production') ? 'prod' : envFile.includes('staging') ? 'staging' : 'local';
const filename = `backups/retro-tool-${envName}-${timestamp}.sql`;

const backupsDir = resolve(process.cwd(), 'backups');
execSync(`mkdir -p "${backupsDir}"`, { stdio: 'ignore' });

console.log(`Backing up database (${envName})...`);
console.log(`Output: ${filename}`);

try {
  execSync(`pg_dump "${databaseUrl}" --no-owner --no-acl -F p -f "${filename}"`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log(`\nBackup complete: ${filename}`);
} catch {
  console.error('\nBackup failed. Ensure pg_dump is installed and DATABASE_URL is reachable.');
  process.exit(1);
}
