import { SURVEY_SCOPES, USER_ROLES } from '../common/enums';
import type { Survey, SurveyQuestion } from './schema';
import type { SurveyUserContext } from './types';

/**
 * Pure survey helpers — access-control predicates, scope labelling, and option
 * parsing. Kept free of DB or service state so the permission matrix can be
 * reasoned about (and unit-tested) in isolation and shared by the query and
 * mutation services.
 */

export function isSystemAdmin(role: string): boolean {
  return role === USER_ROLES.SuperAdmin || role === USER_ROLES.SystemAdmin;
}

export function scopeLabel(record: Survey): string {
  if (record.scope === SURVEY_SCOPES.System) return 'Everyone';
  return record.scope === SURVEY_SCOPES.Org ? 'Organization' : 'Team';
}

export function parseOptions(question: SurveyQuestion): string[] {
  if (!question.options) return [];
  try {
    const parsed = JSON.parse(question.options) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Close / delete permission (scope-dependent):
 * - Team:   creator, team lead, org owner/admin of the team's org, sys/super admin
 * - Org:    creator, org owner/admin of that org, sys/super admin
 * - System: sys/super admin only
 */
export function canManage(
  record: Survey,
  userId: string,
  ctx: SurveyUserContext,
): boolean {
  if (isSystemAdmin(ctx.role)) return true;
  if (record.scope === SURVEY_SCOPES.System) return false;

  if (record.createdById === userId) return true;

  if (record.scope === SURVEY_SCOPES.Team && record.teamId) {
    if (ctx.leadTeamIds.includes(record.teamId)) return true;
    const parentOrgId = ctx.orgIdByTeamId[record.teamId];
    return parentOrgId ? ctx.orgAdminIds.includes(parentOrgId) : false;
  }
  if (record.scope === SURVEY_SCOPES.Org && record.organizationId) {
    return ctx.orgAdminIds.includes(record.organizationId);
  }
  return false;
}

/**
 * Edit permission (title/description/questions): the creator, or a
 * system/super admin — at every scope. System-wide surveys are editable
 * only by system/super admins (they are also the only possible creators).
 */
export function canEdit(
  record: Survey,
  userId: string,
  ctx: SurveyUserContext,
): boolean {
  if (isSystemAdmin(ctx.role)) return true;
  if (record.scope === SURVEY_SCOPES.System) return false;
  return record.createdById === userId;
}

export function canSee(record: Survey, ctx: SurveyUserContext): boolean {
  if (record.scope === SURVEY_SCOPES.System) return true;
  if (record.scope === SURVEY_SCOPES.Team && record.teamId) {
    return ctx.teamIds.includes(record.teamId);
  }
  if (record.scope === SURVEY_SCOPES.Org && record.organizationId) {
    return ctx.orgIds.includes(record.organizationId);
  }
  return false;
}
