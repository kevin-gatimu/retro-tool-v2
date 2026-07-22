import { describe, expect, it } from 'vitest'
import {
  closestTemplateLabel,
  formatDuration,
  formatTime,
  getVoteStats,
  isValidUrl,
  parseDate,
} from './index'
import type { EstimateSession } from '@/common/types/estimates'

// Minimal template stub for the label-matching helpers.
const template = {
  id: 't1',
  name: 'Fibonacci',
  color: null,
  values: [
    {
      id: 'v1',
      label: 'XS',
      value: '1',
      order: 0,
      color: null,
      description: null,
    },
    {
      id: 'v2',
      label: 'S',
      value: '3',
      order: 1,
      color: null,
      description: null,
    },
    {
      id: 'v3',
      label: 'M',
      value: '8',
      order: 2,
      color: null,
      description: null,
    },
  ],
} satisfies NonNullable<EstimateSession['template']>

describe('estimate/helpers', () => {
  describe('formatTime', () => {
    it('zero-pads minutes and seconds', () => {
      expect(formatTime(0)).toBe('00:00')
      expect(formatTime(65)).toBe('01:05')
      expect(formatTime(600)).toBe('10:00')
    })
  })

  describe('formatDuration', () => {
    it('formats seconds, minutes, and hours', () => {
      expect(formatDuration(5_000)).toBe('5s')
      expect(formatDuration(65_000)).toBe('1m 5s')
      expect(formatDuration(3_725_000)).toBe('1h 2m')
    })
  })

  describe('getVoteStats', () => {
    it('returns zeros for no votes', () => {
      expect(getVoteStats(undefined)).toEqual({ average: 0, min: 0, max: 0 })
      expect(getVoteStats([])).toEqual({ average: 0, min: 0, max: 0 })
    })

    it('averages numeric votes and reports min/max, ignoring non-numeric', () => {
      expect(getVoteStats([2, 4, 8])).toEqual({ average: 4.7, min: 2, max: 8 })
      expect(getVoteStats(['5', '?', '3'])).toEqual({
        average: 4,
        min: 3,
        max: 5,
      })
    })
  })

  describe('isValidUrl', () => {
    it('allows empty and http(s) URLs, rejects other schemes', () => {
      expect(isValidUrl('')).toBe(true)
      expect(isValidUrl('   ')).toBe(true)
      expect(isValidUrl('https://jira.example.com/x')).toBe(true)
      expect(isValidUrl('http://x')).toBe(true)
      expect(isValidUrl('ftp://x')).toBe(false)
      expect(isValidUrl('not a url')).toBe(false)
    })
  })

  describe('parseDate', () => {
    it('returns null for empty/invalid and a Date for valid input', () => {
      expect(parseDate(null)).toBeNull()
      expect(parseDate(undefined)).toBeNull()
      expect(parseDate('nonsense')).toBeNull()
      expect(parseDate('2026-07-16T00:00:00.000Z')).toBeInstanceOf(Date)
    })
  })

  describe('closestTemplateLabel', () => {
    it('returns null without a template', () => {
      expect(closestTemplateLabel(5, null)).toBeNull()
    })

    it('picks the label nearest to the average', () => {
      expect(closestTemplateLabel(2, template)).toBe('XS')
      expect(closestTemplateLabel(7, template)).toBe('M')
    })
  })
})
