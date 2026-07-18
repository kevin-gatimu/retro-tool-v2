import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Presence toggle for the participant endpoint — mirrors the gateway's
 * join-session (`online: true`) / leave-session (`online: false`) commands,
 * which both funnel into `estimatesService.upsertParticipant`.
 */
export const ParticipantPresenceSchema = z.object({
  online: z.boolean(),
});

export type ParticipantPresenceDto = z.infer<typeof ParticipantPresenceSchema>;

export class ParticipantPresenceBody {
  @ApiProperty({
    example: true,
    description:
      'Whether the participant is online (true = join, false = leave)',
  })
  online: boolean;
}
