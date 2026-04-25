import { Module } from '@nestjs/common';
import { EstimateTemplatesController } from './estimate-templates.controller';
import { EstimateTemplatesService } from './estimate-templates.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EstimateTemplatesController],
  providers: [EstimateTemplatesService],
  exports: [EstimateTemplatesService],
})
export class EstimateTemplatesModule {}
