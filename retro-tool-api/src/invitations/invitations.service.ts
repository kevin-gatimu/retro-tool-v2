import { Injectable, NotFoundException } from '@nestjs/common';
import { OrgInvitationsService } from '../organizations/invitations/invitations.service';
import { TeamInvitationsService } from '../teams/invitations/invitations.service';
import type { InvitationPreview } from './types';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly orgInvitations: OrgInvitationsService,
    private readonly teamInvitations: TeamInvitationsService,
  ) {}

  async getPreview(token: string): Promise<InvitationPreview> {
    try {
      return await this.orgInvitations.getOrgInvitationPreview(token);
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
    }
    try {
      return await this.teamInvitations.getTeamInvitationPreview(token);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new NotFoundException('Invitation not found');
      }
      throw err;
    }
  }

  async accept(
    token: string,
    userId: string,
  ): Promise<{
    type: 'org' | 'team';
    organizationId: string;
    teamId?: string;
  }> {
    let preview: InvitationPreview;
    try {
      preview = await this.getPreview(token);
    } catch {
      throw new NotFoundException('Invitation not found');
    }

    if (preview.type === 'org') {
      const result = await this.orgInvitations.acceptOrgInvitation(
        token,
        userId,
      );
      return { type: 'org', organizationId: result.organizationId };
    }

    const result = await this.teamInvitations.acceptTeamInvitation(
      token,
      userId,
    );
    return {
      type: 'team',
      organizationId: result.organizationId,
      teamId: result.teamId,
    };
  }
}
