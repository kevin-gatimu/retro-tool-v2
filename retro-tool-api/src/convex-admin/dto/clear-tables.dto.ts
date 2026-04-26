import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClearTablesDto {
  @ApiProperty({
    example: ['livePresence', 'liveTyping', 'liveReadyStatus'],
    description: 'Convex table names to clear immediately',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tableNames!: string[];
}
