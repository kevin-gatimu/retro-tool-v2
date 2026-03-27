import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL!;
const lowerUrl = databaseUrl.toLowerCase();
const useSsl =
  lowerUrl.includes('.postgres.database.azure.com') ||
  lowerUrl.includes('ssl=true') ||
  lowerUrl.includes('sslmode=require') ||
  lowerUrl.includes('sslmode=verify-ca') ||
  lowerUrl.includes('sslmode=verify-full');

export default defineConfig({
  schema: './src/**/schema/**.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
    ssl: useSsl ? true : false,
  },
});
