import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const CreateEstimateSessionSchema = z.object({
  name: z.string().min(1).max(255),
  teamId: z.string().min(1),
  sprintLink: z.string().url().max(2048).optional(),
  timerDuration: z.number().int().positive().max(3600).optional(),
});

export type CreateEstimateSessionDto = z.infer<
  typeof CreateEstimateSessionSchema
>;

export class CreateEstimateSessionBody {
  @ApiProperty({ example: 'Sprint 42 Planning' })
  name: string;

  @ApiProperty({ example: 'team_abc123' })
  teamId: string;

  @ApiProperty({
    example: 'https://jira.local/secure/RapidBoard.jspa?rapidView=12',
    required: false,
  })
  sprintLink?: string;

  @ApiProperty({ example: 60, required: false })
  timerDuration?: number;
}

export const NewEstimateRoundSchema = z.object({
  ticketNumber: z.string().min(1).max(100),
  storyName: z.string().min(1).max(255).optional(),
  storyDescription: z.string().max(5000).optional(),
  storyLink: z.string().url().max(2048).optional(),
});

export type NewEstimateRoundDto = z.infer<typeof NewEstimateRoundSchema>;

export class NewEstimateRoundBody {
  @ApiProperty({ example: 'SPR-002' })
  ticketNumber: string;

  @ApiProperty({ example: 'Implement forgot password', required: false })
  storyName?: string;

  @ApiProperty({ example: 'Add reset token flow', required: false })
  storyDescription?: string;

  @ApiProperty({
    example: 'https://jira.local/browse/SPR-002',
    required: false,
  })
  storyLink?: string;
}

export const SetConsensusSchema = z.object({
  agreedPoints: z.string().min(1).max(20),
});

export type SetConsensusDto = z.infer<typeof SetConsensusSchema>;

export class SetConsensusBody {
  @ApiProperty({ example: '5' })
  agreedPoints: string;
}

export const UpdateEstimateStorySchema = z.object({
  storyName: z.string().min(1).max(255),
  ticketNumber: z.string().min(1).max(100),
  storyDescription: z.string().max(5000).optional(),
  storyLink: z.string().url().max(2048).optional(),
});

export type UpdateEstimateStoryDto = z.infer<typeof UpdateEstimateStorySchema>;

export class UpdateEstimateStoryBody {
  @ApiProperty({ example: 'Refactor dashboard filters' })
  storyName: string;

  @ApiProperty({ example: 'SPR-003' })
  ticketNumber: string;

  @ApiProperty({ required: false })
  storyDescription?: string;

  @ApiProperty({ required: false })
  storyLink?: string;
}
