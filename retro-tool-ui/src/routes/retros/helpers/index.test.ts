import { describe, expect, it } from 'vitest'
import {
  canProceed,
  formatTime,
  getInitials,
  getStatusColor,
  getStatusLabel,
} from './index'

describe('retros/helpers', () => {
  describe('formatTime', () => {
    it('formats m:ss with zero-padded seconds', () => {
      expect(formatTime(65)).toBe('1:05')
      expect(formatTime(9)).toBe('0:09')
      expect(formatTime(600)).toBe('10:00')
    })
  })

  describe('getStatusLabel / getStatusColor', () => {
    it('maps known statuses to labels', () => {
      expect(getStatusLabel('draft')).toBe('Not Started')
      expect(getStatusLabel('active')).toBe('Adding Cards')
      expect(getStatusLabel('completed')).toBe('Completed')
      expect(getStatusLabel('mystery')).toBe('mystery')
    })

    it('maps statuses to badge variants', () => {
      expect(getStatusColor('draft')).toBe('secondary')
      expect(getStatusColor('completed')).toBe('outline')
      expect(getStatusColor('voting')).toBe('default')
    })
  })

  describe('getInitials', () => {
    it('handles empty, single, and multi-word names', () => {
      expect(getInitials(null)).toBe('?')
      expect(getInitials('')).toBe('?')
      expect(getInitials('alice')).toBe('A')
      expect(getInitials('Ada Lovelace')).toBe('AL')
      expect(getInitials('  jean  paul  sartre ')).toBe('JS')
    })
  })

  describe('canProceed', () => {
    it('gates template/team steps on a selection; later steps always pass', () => {
      expect(canProceed('template', null, null)).toBe(false)
      expect(canProceed('template', 't1', null)).toBe(true)
      expect(canProceed('team', 't1', null)).toBe(false)
      expect(canProceed('team', 't1', 'team1')).toBe(true)
      expect(canProceed('settings', null, null)).toBe(true)
      expect(canProceed('confirm', null, null)).toBe(true)
      expect(canProceed('unknown', 't1', 'team1')).toBe(false)
    })
  })
})
