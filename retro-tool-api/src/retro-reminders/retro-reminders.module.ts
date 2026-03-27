import { Module } from '@nestjs/common';
import { RetroRemindersService } from './retro-reminders.service';
import { RetroRemindersController } from './retro-reminders.controller';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, EmailModule],
  controllers: [RetroRemindersController],
  providers: [RetroRemindersService],
})
export class RetroRemindersModule {}
