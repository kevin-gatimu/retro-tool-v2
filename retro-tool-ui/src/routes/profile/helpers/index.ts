import { Monitor, Smartphone, Tablet } from 'lucide-react'

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

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
