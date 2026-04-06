import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RETRO_VOTE_TYPES, type TRetroVoteType } from '../../common/enums';

export const createRetroSchema = z.object({
  name: z.string().min(1).max(200),
  teamId: z.string().min(1),
  templateId: z.string().min(1),
  isAnonymous: z.boolean().default(true),
  maxVotesPerUser: z.number().int().min(1).max(10).default(3),
  voteType: z
    .enum(Object.values(RETRO_VOTE_TYPES) as [string, ...string[]])
    .default(RETRO_VOTE_TYPES.Multi),
  timerDuration: z.number().int().min(60).max(3600).optional(),
  scheduledAt: z.iso.datetime().optional(), // ISO-8601 planned start time
});
export type CreateRetroDto = z.infer<typeof createRetroSchema>;

export class CreateRetroDtoClass {
  @ApiProperty({ description: 'Retrospective name', maxLength: 200 })
  name: string;

  @ApiProperty({ description: 'Team ID' })
  teamId: string;

  @ApiProperty({ description: 'Template ID' })
  templateId: string;

  @ApiPropertyOptional({ description: 'Anonymous mode', default: true })
  isAnonymous?: boolean;

  @ApiPropertyOptional({
    description: 'Max votes per user',
    minimum: 1,
    maximum: 10,
    default: 3,
  })
  maxVotesPerUser?: number;

  @ApiPropertyOptional({
    description: 'Vote type',
    enum: Object.values(RETRO_VOTE_TYPES),
    default: RETRO_VOTE_TYPES.Multi,
  })
  voteType?: TRetroVoteType;

  @ApiPropertyOptional({
    description: 'Timer duration in seconds (60–3600)',
    minimum: 60,
    maximum: 3600,
  })
  timerDuration?: number;
}
