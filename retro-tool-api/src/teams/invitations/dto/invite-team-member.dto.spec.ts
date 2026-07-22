import { inviteTeamMemberSchema } from './invite-team-member.dto';

describe('inviteTeamMemberSchema', () => {
  it('accepts a valid email with a known tag', () => {
    const result = inviteTeamMemberSchema.safeParse({
      email: 'user@example.com',
      tag: 'team-lead',
    });
    expect(result.success).toBe(true);
  });

  it('defaults tag to member when omitted', () => {
    const result = inviteTeamMemberSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tag).toBe('member');
    }
  });

  it('rejects a malformed email', () => {
    const result = inviteTeamMemberSchema.safeParse({
      email: 'nope',
      tag: 'member',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown tag', () => {
    const result = inviteTeamMemberSchema.safeParse({
      email: 'user@example.com',
      tag: 'owner',
    });
    expect(result.success).toBe(false);
  });
});
