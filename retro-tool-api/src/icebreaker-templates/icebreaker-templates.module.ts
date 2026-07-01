import { Module } from '@nestjs/common';
import { IcebreakerTemplatesController } from './icebreaker-templates.controller';
import { IcebreakerTemplatesService } from './icebreaker-templates.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [IcebreakerTemplatesController],
  providers: [IcebreakerTemplatesService],
  exports: [IcebreakerTemplatesService],
})
export class IcebreakerTemplatesModule {}
