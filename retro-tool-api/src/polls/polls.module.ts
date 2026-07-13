import { Module } from '@nestjs/common';
import { PollsService } from './polls.service';
import { PollsController } from './polls.controller';
import { PollsProjectionSyncService } from './polls-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { StandupsModule } from '../standups/standups.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, StandupsModule, EmailModule],
  controllers: [PollsController],
  providers: [PollsService, PollsProjectionSyncService],
  exports: [PollsService],
})
export class PollsModule {}
