import { inviteOrgMemberSchema } from './invite-org-member.dto';

describe('inviteOrgMemberSchema', () => {
  it('accepts a valid email with an assignable role', () => {
    const result = inviteOrgMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'org-admin',
    });
    expect(result.success).toBe(true);
  });

  it('defaults role to member when omitted', () => {
    const result = inviteOrgMemberSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('member');
    }
  });

  it('rejects a malformed email', () => {
    const result = inviteOrgMemberSchema.safeParse({
      email: 'not-an-email',
      role: 'member',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown role string', () => {
    const result = inviteOrgMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'super-admin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an oversized email', () => {
    const result = inviteOrgMemberSchema.safeParse({
      email: `${'a'.repeat(320)}@example.com`,
      role: 'member',
    });
    expect(result.success).toBe(false);
  });
});
