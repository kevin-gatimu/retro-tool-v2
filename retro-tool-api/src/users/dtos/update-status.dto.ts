import { z } from 'zod';
import { TUserStatus, USER_STATUSES } from '../../common/enums';
import { ApiProperty } from '@nestjs/swagger';

export const updateStatusSchema = z.object({
  status: z.enum([USER_STATUSES.Approved, USER_STATUSES.Rejected]),
});

export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;

export class UpdateStatusDtoClass {
  @ApiProperty({
    description: 'New user status',
    enum: [USER_STATUSES.Approved, USER_STATUSES.Rejected],
  })
  status: TUserStatus;
}
