import { Module } from '@nestjs/common';
import { ActionItemsService } from './action-items.service';
import { ActionItemsController } from './action-items.controller';
import { DatabaseModule } from '../database/database.module';
import { RetrosModule } from '../retros/retros.module';

@Module({
  imports: [DatabaseModule, RetrosModule],
  controllers: [ActionItemsController],
  providers: [ActionItemsService],
  exports: [ActionItemsService],
})
export class ActionItemsModule {}
