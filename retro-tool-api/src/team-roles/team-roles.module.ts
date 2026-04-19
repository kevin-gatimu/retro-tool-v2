import { Module } from '@nestjs/common';
import { TeamRolesService } from './team-roles.service';
import {
  TeamRolesController,
  OrgTeamRolesController,
} from './team-roles.controller';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [TeamRolesController, OrgTeamRolesController],
  providers: [TeamRolesService],
  exports: [TeamRolesService],
})
export class TeamRolesModule {}
