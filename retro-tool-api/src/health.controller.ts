import { Controller, Get, Inject } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { DATABASE_CONNECTION } from './database/database-connection';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

@AllowAnonymous()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase,
  ) {}

  @Get()
  async getHealth() {
    const dbOk = await this.checkDatabase();
    const status = dbOk ? 'ok' : 'degraded';

    return {
      status,
      service: 'retro-tool-api',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'connected' : 'unreachable',
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.database.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }
}
