import { describe, expect, it } from 'vitest'
import {
  inviteEmailCheckColorClass,
  inviteEmailCheckMessage,
} from './invite-email-check'

describe('invite-email-check', () => {
  describe('inviteEmailCheckColorClass', () => {
    it('member wins over registered, registered over default', () => {
      expect(
        inviteEmailCheckColorClass({ registered: true, isMember: true }),
      ).toBe('text-destructive')
      expect(inviteEmailCheckColorClass({ registered: true })).toBe(
        'text-emerald-400',
      )
      expect(inviteEmailCheckColorClass({ registered: false })).toBe(
        'text-gray-400',
      )
    })
  })

  describe('inviteEmailCheckMessage', () => {
    it('uses the memberScope in the already-a-member message', () => {
      expect(
        inviteEmailCheckMessage({ registered: true, isMember: true }, 'team'),
      ).toContain('team')
      expect(
        inviteEmailCheckMessage(
          { registered: true, isMember: true },
          'organisation',
        ),
      ).toContain('organisation')
    })

    it('includes the name when registered', () => {
      expect(
        inviteEmailCheckMessage({ registered: true, name: 'Ada' }, 'team'),
      ).toContain('(Ada)')
    })

    it('prompts to register when not found', () => {
      expect(inviteEmailCheckMessage({ registered: false }, 'team')).toMatch(
        /register/i,
      )
    })
  })
})
