/**
 * Admin route type definitions
 */

// Import common types
import type {
  EditableColumn,
  PaginatedTemplatesResponse as CommonPaginatedTemplatesResponse,
} from '@/common/types'
import type { TUserStatus, TUserRole } from '@/common/enums/user.enums'
import type { TOrgMemberRole } from '@/common/enums/organization.enums'

// ─────────────────────────────────────────────────────────────────────────────
// org-setup.tsx types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatedOrg {
  id: string
  name: string
}

export interface SelectedUser {
  id: string
  name: string
  email: string
}

export interface TeamDraft {
  name: string
  leadId?: string
  leadName?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// users.tsx types
// ─────────────────────────────────────────────────────────────────────────────

export type UserDetails = {
  user: {
    id: string
    name: string
    email: string
    status: TUserStatus
    role: TUserRole
    image?: string | null
    bio?: string | null
    suspendedReason?: string | null
    suspendedAt?: string | Date | null
    createdAt: string | Date
    lastActiveAt?: string | Date | null
  }
  organizations: Array<{
    id: string
    role: TOrgMemberRole
    organization: { name: string }
  }>
  teams: Array<{
    id: string
    role: string | null
    tag: string
    team: { name: string; organization: { name: string } }
  }>
  actionHistory: Array<{
    id: string
    action: string
    createdAt: string | Date
    admin?: { name: string } | null
  }>
}

export type UsersPage = {
  users: Array<{
    id: string
    name: string
    email: string
    status: TUserStatus
    role: TUserRole
    image?: string | null
    createdAt: string | Date
    lastActiveAt?: string | Date | null
  }>
  total: number
  page: number
  limit: number
  totalPages: number
  stats: {
    pending: number
    approved: number
    suspended: number
    rejected: number
    admins: number
  }
}

export type ActionLogEntry = {
  id: string
  action: string
  details?: Record<string, unknown> | null
  createdAt: string | Date
  admin?: { name: string } | null
  targetUser?: { name: string } | null
}

export type PaginatedActionLog = {
  logs: ActionLogEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─────────────────────────────────────────────────────────────────────────────
// templates.tsx types
// ─────────────────────────────────────────────────────────────────────────────

// EditableColumn is imported from @/common/helpers
export type { EditableColumn }

export type TemplateWithColumns = {
  id: string
  name: string
  description?: string | null
  organizationId?: string | null
  organizationName?: string | null
  isBuiltIn: boolean
  createdAt: string | Date
  updatedAt: string | Date
  columns: Array<{
    id: string
    name: string
    emoji: string | null
    prompt: string | null
    order: number
  }>
}

// Use common PaginatedTemplatesResponse
export type PaginatedTemplatesResponse = CommonPaginatedTemplatesResponse

// ─────────────────────────────────────────────────────────────────────────────
// organizations.tsx types
// ─────────────────────────────────────────────────────────────────────────────

export type OrganizationAdminRow = {
  id: string
  name: string
  slug: string
  ownerId: string
  memberCount?: number
  createdAt: string | Date
}

export type PaginatedOrgsResponse = {
  organizations: OrganizationAdminRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─────────────────────────────────────────────────────────────────────────────
// convex.tsx types
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricPoint {
  timestamp: string
  value: number | null
}

export interface NamedMetricSeries {
  name: string
  points: MetricPoint[]
}

export type ConvexHealthStatus = 'healthy' | 'degraded' | 'unavailable'

export interface OperationalMetrics {
  generatedAt: string
  rangeMinutes: number
  bucketCount: number
  bucketMinutes: number
  status: 'available' | 'partial' | 'unavailable'
  errors: Array<{ metric: string; message: string }>
  functionCalls: NamedMetricSeries[]
  failurePercentages: NamedMetricSeries[]
  cacheHitPercentages: NamedMetricSeries[]
  subscriptionInvalidations: NamedMetricSeries[]
  scheduledJobLag: MetricPoint[]
  concurrency: {
    running: NamedMetricSeries[]
    queued: NamedMetricSeries[]
  }
  summaries: {
    totalCalls: number | null
    maxFailurePercentage: number | null
    averageCacheHitPercentage: number | null
    maxScheduledJobLagSeconds: number | null
    peakRunning: number | null
    peakQueued: number | null
    averageCallsPerMinute: number | null
    queuedBucketPercentage: number | null
  }
  health: {
    status: ConvexHealthStatus
    checks: Array<{
      name: string
      status: ConvexHealthStatus
      message: string
      value?: number
      unit?: string
    }>
  }
  insights: Array<{
    severity: 'info' | 'warning' | 'critical'
    category: 'capacity' | 'reliability' | 'performance' | 'activity'
    title: string
    description: string
    evidence: string
    impact: string
    recommendation: string
  }>
}

export interface UsageMetricEntry {
  used: number
  quota: number
}

export interface UsageMetrics {
  functionCalls: UsageMetricEntry | null
  actionCompute: UsageMetricEntry | null
  databaseStorage: UsageMetricEntry | null
  databaseBandwidth: UsageMetricEntry | null
  fileStorage: UsageMetricEntry | null
  fileBandwidth: UsageMetricEntry | null
  vectorStorage: UsageMetricEntry | null
  vectorBandwidth: UsageMetricEntry | null
  deployments: UsageMetricEntry | null
  chefTokens: UsageMetricEntry | null
}

export interface ConvexCronConfigResponse {
  id: string
  schedule: string
  enabled: boolean
  tablesToClear: string[]
  updatedAt: string | null
  updatedByUserId: string | null
}
