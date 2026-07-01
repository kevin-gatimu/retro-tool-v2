import { Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from './database-connection';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schemaEnums from '../common/schema-enums';
import * as usersSchema from '../users/schema';
import * as authSchema from '../auth/schema';
import * as teamsSchema from '../teams/schema';
import * as organizationsSchema from '../organizations/schema';
import * as userPreferencesSchema from '../user-preferences/schema';
import * as retrosSchema from '../retros/schema';
import * as notificationsSchema from '../notifications/schema';
import * as estimatesSchema from '../estimates/schema';
import * as icebreakersSchema from '../icebreakers/schema';
import * as emailSchema from '../email/schema';

@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');

        // Check if this is an Azure PostgreSQL connection (contains .postgres.database.azure.com)
        const isAzurePostgres = databaseUrl.includes(
          '.postgres.database.azure.com',
        );

        // Strip sslmode from the URL — pg-connection-string emits a deprecation
        // warning for 'require'/'prefer'/'verify-ca'; SSL is controlled via the
        // ssl option below instead.
        const url = new URL(databaseUrl);
        url.searchParams.delete('sslmode');

        const pool = new Pool({
          connectionString: url.toString(),
          ssl: isAzurePostgres ? { rejectUnauthorized: false } : false,
        });

        return drizzle(pool, {
          schema: {
            ...schemaEnums,
            ...usersSchema,
            ...authSchema,
            ...teamsSchema,
            ...organizationsSchema,
            ...userPreferencesSchema,
            ...retrosSchema,
            ...notificationsSchema,
            ...estimatesSchema,
            ...icebreakersSchema,
            ...emailSchema,
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
