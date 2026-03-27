/**
 * Dashboard route helper functions
 */
import { Monitor, Smartphone, Tablet } from 'lucide-react'

/**
 * Get device icon based on user agent string
 */
export function getDeviceIcon(userAgent: string) {
  if (!userAgent) return Monitor
  const ua = userAgent.toLowerCase()
  if (
    ua.includes('mobile') ||
    ua.includes('iphone') ||
    ua.includes('android')
  ) {
    return Smartphone
  }
  if (ua.includes('ipad') || ua.includes('tablet')) return Tablet
  return Monitor
}

/**
 * Get browser info from user agent
 */
export function getBrowserInfo(userAgent: string): string {
  if (!userAgent) return 'Unknown Browser'
  const ua = userAgent.toLowerCase()
  if (ua.includes('edg/') || ua.includes('edgios/') || ua.includes('edga/'))
    return 'Edge'
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera'
  if (ua.includes('chrome')) return 'Chrome'
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('safari')) return 'Safari'
  return 'Unknown Browser'
}

/**
 * Get OS info from user agent
 */
export function getOSInfo(userAgent: string): string {
  if (!userAgent) return 'Unknown OS'
  const ua = userAgent.toLowerCase()
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('mac')) return 'macOS'
  if (ua.includes('linux')) return 'Linux'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS'
  return 'Unknown OS'
}

/**
 * Generate initials from a full name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Parse date handling both Date objects and strings, with NaN checks
 */
export function parseDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  const parsed = new Date(date)
  return isNaN(parsed.getTime()) ? null : parsed
}
