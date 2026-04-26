import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const CRON_REGEX =
  /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;

export class UpdateCronConfigDto {
  @ApiPropertyOptional({
    example: '0 0 * * 0',
    description: '5-part cron expression',
  })
  @IsOptional()
  @IsString()
  @Matches(CRON_REGEX, {
    message: 'schedule must be a valid 5-part cron expression',
  })
  schedule?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    example: ['liveRetroSessions', 'livePresence'],
    description: 'Convex table names to clear on each cron run',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tablesToClear?: string[];
}
