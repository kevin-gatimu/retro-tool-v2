import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { ConvexAdminService } from './convex-admin.service';
import type { SessionUser } from '../common/types';
import { UpdateCronConfigDto } from './dto/update-cron-config.dto';
import { ClearTablesDto } from './dto/clear-tables.dto';

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
  clearTables(@Session() session: SessionUser, @Body() dto: ClearTablesDto) {
    return this.convexAdminService.clearTables(session.user.id, dto.tableNames);
  }
}
