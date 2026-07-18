import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SkipThrottle } from '@nestjs/throttler';
import { DATABASE_CONNECTION } from './database/database-connection';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { APP_VERSION } from './lib/app-version';

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
      version: APP_VERSION,
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
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe (checks DB connectivity)',
  })
  @ApiResponse({ status: 200, description: 'Readiness status with DB check' })
  @ApiResponse({ status: 503, description: 'Database dependency is not ready' })
  async getReadiness() {
    const dbOk = await this.checkDatabase();

    const result = {
      status: dbOk ? 'ready' : 'not_ready',
      service: 'retro-tool-api',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'connected' : 'unreachable',
      },
    };

    if (!dbOk) {
      throw new ServiceUnavailableException(result);
    }

    return result;
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
