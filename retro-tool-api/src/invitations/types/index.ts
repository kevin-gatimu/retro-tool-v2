import type { OrgInvitationsService } from '../../organizations/invitations/invitations.service';
import type { TeamInvitationsService } from '../../teams/invitations/invitations.service';

export type InvitationPreview =
  | Awaited<ReturnType<OrgInvitationsService['getOrgInvitationPreview']>>
  | Awaited<ReturnType<TeamInvitationsService['getTeamInvitationPreview']>>;
