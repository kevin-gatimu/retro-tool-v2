import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

// Web Push subscription keys are base64url strings; cap length so an oversized
// payload can't reach the DB. Endpoint is a push-service URL.
export const pushSubscribeSchema = z.object({
  endpoint: z.url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
});

export type PushSubscribeDto = z.infer<typeof pushSubscribeSchema>;

export class PushSubscribeDtoClass {
  @ApiProperty({
    description: 'Push service endpoint URL',
    maxLength: 2048,
  })
  endpoint: string;

  @ApiProperty({ description: 'Client public key (p256dh)', maxLength: 512 })
  p256dh: string;

  @ApiProperty({ description: 'Auth secret', maxLength: 512 })
  auth: string;
}
