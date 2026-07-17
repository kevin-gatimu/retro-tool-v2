import { z } from 'zod';

// Invitation tokens are opaque, non-empty strings with a sane upper bound so an
// oversized param can't reach the lookup query.
export const invitationTokenSchema = z.string().min(1).max(512);

export type InvitationToken = z.infer<typeof invitationTokenSchema>;
