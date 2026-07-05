import { Module } from '@nestjs/common';
import { PollsService } from './polls.service';
import { PollsController } from './polls.controller';
import { DatabaseModule } from '../database/database.module';
import { StandupsModule } from '../standups/standups.module';

@Module({
  imports: [DatabaseModule, StandupsModule],
  controllers: [PollsController],
  providers: [PollsService],
  exports: [PollsService],
})
export class PollsModule {}
