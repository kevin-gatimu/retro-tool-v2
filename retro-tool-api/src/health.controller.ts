import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SkipThrottle } from '@nestjs/throttler';
import { DATABASE_CONNECTION } from './database/database-connection';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Liveness/readiness probes must never be rate-limited.
@SkipThrottle()
@ApiTags('health')
@AllowAnonymous()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Full health check with DB status (degraded/ok)',
  })
  @ApiResponse({ status: 200, description: 'Health status with DB check' })
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

  @Get('live')
  @ApiOperation({
    summary: 'Lightweight liveness probe (always responds if process is alive)',
  })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  getLiveness() {
    return {
      status: 'alive',
      service: 'retro-tool-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe (checks DB connectivity)',
  })
  @ApiResponse({ status: 200, description: 'Readiness status with DB check' })
  async getReadiness() {
    const dbOk = await this.checkDatabase();

    return {
      status: dbOk ? 'ready' : 'not_ready',
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
