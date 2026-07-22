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
import { JwtAlignmentService } from './auth/jwt-alignment.service';
import type { JwtAlignmentStatus } from './auth/types';

// Liveness/readiness probes must never be rate-limited.
@SkipThrottle()
@ApiTags('health')
@AllowAnonymous()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase,
    private readonly jwtAlignment: JwtAlignmentService,
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
    summary: 'Readiness probe (checks DB connectivity + JWT/JWKS alignment)',
  })
  @ApiResponse({ status: 200, description: 'Readiness status with checks' })
  @ApiResponse({ status: 503, description: 'A dependency is not ready' })
  async getReadiness() {
    const [dbOk, jwt] = await Promise.all([
      this.checkDatabase(),
      this.checkJwtAlignment(),
    ]);

    // A misaligned/unreachable JWKS silently disables every authenticated
    // Convex read, so it must fail readiness loudly — not just be reported.
    const ready = dbOk && jwt === 'ok';

    const result = {
      status: ready ? 'ready' : 'not_ready',
      service: 'retro-tool-api',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'connected' : 'unreachable',
        jwt,
      },
    };

    if (!ready) {
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

  /**
   * Resolve JWT ↔ JWKS alignment to a single status field. The underlying
   * check never throws, but guard here too so the health handler can never be
   * taken down by the guardrail itself.
   */
  private async checkJwtAlignment(): Promise<JwtAlignmentStatus> {
    try {
      const result = await this.jwtAlignment.check();
      return result.status;
    } catch {
      return 'unreachable';
    }
  }
}
