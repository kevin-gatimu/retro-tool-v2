import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersQueryService } from './users-query.service';
import { UsersAdminService } from './users-admin.service';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, CommonModule, EmailModule],
  controllers: [UsersController],
  providers: [UsersService, UsersQueryService, UsersAdminService],
})
export class UsersModule {}
