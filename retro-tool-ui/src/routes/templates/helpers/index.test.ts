import { describe, expect, it } from 'vitest'
import { resolveEligibleOrgs } from './index'
import type { Organization } from '@/common/types/organizations'
import type { Team } from '@/common/types/teams'

const org = (id: string): Organization => ({ id }) as Organization
const team = (organizationId: string, myRole: string): Team =>
  ({ organizationId, myRole }) as unknown as Team

const orgA = org('a')
const orgB = org('b')

describe('templates/helpers · resolveEligibleOrgs', () => {
  it('system admins get all organizations', () => {
    expect(
      resolveEligibleOrgs({
        sysAdmin: true,
        adminOrgs: [],
        isTeamLead: false,
        allOrgs: [orgA, orgB],
        teams: [],
      }),
    ).toEqual([orgA, orgB])
  })

  it('org admins get the orgs they administer (precedence over team-lead)', () => {
    expect(
      resolveEligibleOrgs({
        sysAdmin: false,
        adminOrgs: [orgA],
        isTeamLead: true,
        allOrgs: [orgA, orgB],
        teams: [team('b', 'team-lead')],
      }),
    ).toEqual([orgA])
  })

  it('team leads get orgs where they lead a team', () => {
    expect(
      resolveEligibleOrgs({
        sysAdmin: false,
        adminOrgs: [],
        isTeamLead: true,
        allOrgs: [orgA, orgB],
        teams: [team('b', 'team-lead'), team('a', 'member')],
      }),
    ).toEqual([orgB])
  })

  it('plain members get nothing', () => {
    expect(
      resolveEligibleOrgs({
        sysAdmin: false,
        adminOrgs: [],
        isTeamLead: false,
        allOrgs: [orgA, orgB],
        teams: [team('a', 'member')],
      }),
    ).toEqual([])
  })
})
