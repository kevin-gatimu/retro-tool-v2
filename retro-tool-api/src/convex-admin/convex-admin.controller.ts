import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { ConvexAdminService } from './convex-admin.service';
import type { SessionUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  updateCronConfigSchema,
  UpdateCronConfigDto,
  UpdateCronConfigDtoClass,
  clearTablesSchema,
  ClearTablesDto,
  ClearTablesDtoClass,
} from './dto';

@ApiTags('convex-admin')
@Controller('convex-admin')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class ConvexAdminController {
  constructor(private readonly convexAdminService: ConvexAdminService) {}

  @Get('metrics/operational')
  @ApiOperation({
    summary: 'Get Convex operational metrics (super-admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Operational metrics from Convex admin API',
  })
  getOperationalMetrics(@Session() session: SessionUser) {
    return this.convexAdminService.getOperationalMetrics(session.user.id);
  }

  @Get('metrics/usage')
  @ApiOperation({
    summary: 'Get Convex Cloud billing/usage metrics (super-admin only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Usage metrics from Convex Cloud API, or null if not configured',
  })
  getUsageMetrics(@Session() session: SessionUser) {
    return this.convexAdminService.getUsageMetrics(session.user.id);
  }

  @Get('cron-config')
  @ApiOperation({
    summary: 'Get Convex table-clear cron configuration (super-admin only)',
  })
  getCronConfig() {
    return this.convexAdminService.getCronConfig();
  }

  @Put('cron-config')
  @ApiOperation({
    summary: 'Update Convex table-clear cron configuration (super-admin only)',
  })
  @ApiBody({ type: UpdateCronConfigDtoClass })
  @UsePipes(new ZodValidationPipe(updateCronConfigSchema))
  updateCronConfig(
    @Session() session: SessionUser,
    @Body() dto: UpdateCronConfigDto,
  ) {
    return this.convexAdminService.updateCronConfig(session.user.id, dto);
  }

  @Post('clear-tables')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually clear Convex tables immediately (super-admin only)',
  })
  @ApiBody({ type: ClearTablesDtoClass })
  @UsePipes(new ZodValidationPipe(clearTablesSchema))
  clearTables(@Session() session: SessionUser, @Body() dto: ClearTablesDto) {
    return this.convexAdminService.clearTables(session.user.id, dto.tableNames);
  }

  @Post('reconcile-memberships')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rebuild the Convex team-membership projection from PostgreSQL (super-admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Membership projection reconciled; returns the row count',
  })
  reconcileMemberships(@Session() session: SessionUser) {
    return this.convexAdminService.reconcileMemberships(session.user.id);
  }

  @Post('reconcile-projections')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rebuild every Convex projection from PostgreSQL and prune stale rows (super-admin only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Full reconciliation report with a run ID and per-projection counts',
  })
  reconcileProjections(@Session() session: SessionUser) {
    return this.convexAdminService.reconcileAllProjections(session.user.id);
  }

  @Get('outbox/status')
  @ApiOperation({
    summary: 'Get projection outbox dispatcher status (super-admin only)',
  })
  getOutboxStatus(@Session() session: SessionUser) {
    return this.convexAdminService.getOutboxStatus(session.user.id);
  }

  @Post('outbox/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Pause the projection outbox dispatcher for maintenance (super-admin only)',
  })
  pauseOutbox(@Session() session: SessionUser) {
    return this.convexAdminService.setOutboxPaused(session.user.id, true);
  }

  @Post('outbox/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resume the projection outbox dispatcher and replay buffered events (super-admin only)',
  })
  resumeOutbox(@Session() session: SessionUser) {
    return this.convexAdminService.setOutboxPaused(session.user.id, false);
  }

  @Post('outbox/replay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Drain the entire pending projection outbox in order (super-admin only)',
  })
  replayOutbox(@Session() session: SessionUser) {
    return this.convexAdminService.replayOutbox(session.user.id);
  }
}
