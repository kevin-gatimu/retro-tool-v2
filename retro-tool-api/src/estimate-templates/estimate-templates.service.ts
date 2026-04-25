import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray, count, ilike, or, asc, type SQL } from 'drizzle-orm';
import { estimateTemplate, estimateTemplateValue } from '../estimates/schema';
import * as estimatesSchema from '../estimates/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import * as teamSchema from '../teams/schema';
import { generateId } from '../lib/utils';
import {
  USER_ROLES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
} from '../common/enums';
import { BUILT_IN_ESTIMATE_TEMPLATES } from '../common/data/built-in-estimate-templates';
import type {
  CreateEstimateTemplateBody,
  UpdateEstimateTemplateBody,
} from './dtos';
import type { EstimateTemplateWithValues } from './types';

type Database = NodePgDatabase<
  typeof estimatesSchema &
    typeof authSchema &
    typeof orgSchema &
    typeof teamSchema
>;

export type { EstimateTemplateWithValues };

@Injectable()
export class EstimateTemplatesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  private async assertAccess(
    userId: string,
    organizationId: string | null | undefined,
  ): Promise<void> {
    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const isSystemAdmin =
      fullUser?.role === USER_ROLES.SuperAdmin ||
      fullUser?.role === USER_ROLES.SystemAdmin;

    if (!organizationId) {
      if (!isSystemAdmin) {
        throw new ForbiddenException(
          'Only system admins can manage global estimate templates',
        );
      }
      return;
    }

    if (isSystemAdmin) return;

    // Check org-owner or org-admin
    const [membership] = await this.database
      .select({ role: orgSchema.organizationMember.role })
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.organizationId, organizationId),
          eq(orgSchema.organizationMember.userId, userId),
        ),
      )
      .limit(1);

    if (
      membership?.role === ORG_MEMBER_ROLES.Owner ||
      membership?.role === ORG_MEMBER_ROLES.Admin
    ) {
      return;
    }

    // Check team-lead in any team belonging to this org
    const [teamLeadship] = await this.database
      .select({ tag: teamSchema.teamMember.tag })
      .from(teamSchema.teamMember)
      .innerJoin(
        teamSchema.team,
        eq(teamSchema.teamMember.teamId, teamSchema.team.id),
      )
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.tag, TEAM_MEMBER_TAGS.Lead),
          eq(teamSchema.team.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (teamLeadship) return;

    throw new ForbiddenException(
      'Only organization admins or team leads can manage org estimate templates',
    );
  }

  async getTemplatesPaginated(
    userId: string,
    page: number,
    limit: number,
    type?: 'built-in' | 'organization',
    search?: string,
    sort?: string,
    sortOrder?: 'asc' | 'desc',
  ): Promise<{
    templates: EstimateTemplateWithValues[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const isAdmin =
      fullUser?.role === USER_ROLES.SuperAdmin ||
      fullUser?.role === USER_ROLES.SystemAdmin;

    const conditions: SQL[] = [];
    const normalizedSearch = search?.trim();

    if (type === 'built-in') {
      conditions.push(eq(estimateTemplate.isBuiltIn, true));
    } else if (type === 'organization') {
      conditions.push(eq(estimateTemplate.isBuiltIn, false));
    }

    if (!isAdmin) {
      const memberships = await this.database
        .select({ organizationId: orgSchema.organizationMember.organizationId })
        .from(orgSchema.organizationMember)
        .where(eq(orgSchema.organizationMember.userId, userId));

      const orgIds = memberships.map((m) => m.organizationId);

      if (type === 'organization') {
        if (orgIds.length > 0) {
          conditions.push(inArray(estimateTemplate.organizationId, orgIds));
        } else {
          return { templates: [], total: 0, page, limit };
        }
      } else if (type !== 'built-in') {
        if (orgIds.length > 0) {
          conditions.push(
            or(
              eq(estimateTemplate.isBuiltIn, true),
              inArray(estimateTemplate.organizationId, orgIds),
            )!,
          );
        } else {
          conditions.push(eq(estimateTemplate.isBuiltIn, true));
        }
      }
    }

    if (normalizedSearch) {
      conditions.push(ilike(estimateTemplate.name, `%${normalizedSearch}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await this.database
      .select({ total: count() })
      .from(estimateTemplate)
      .where(whereClause);

    const orderCol =
      sort === 'createdAt'
        ? estimateTemplate.createdAt
        : sort === 'name'
          ? estimateTemplate.name
          : estimateTemplate.id;

    const rows = await this.database
      .select({
        id: estimateTemplate.id,
        name: estimateTemplate.name,
        description: estimateTemplate.description,
        isBuiltIn: estimateTemplate.isBuiltIn,
        organizationId: estimateTemplate.organizationId,
        color: estimateTemplate.color,
        createdAt: estimateTemplate.createdAt,
        updatedAt: estimateTemplate.updatedAt,
        organizationName: orgSchema.organization.name,
      })
      .from(estimateTemplate)
      .leftJoin(
        orgSchema.organization,
        eq(estimateTemplate.organizationId, orgSchema.organization.id),
      )
      .where(whereClause)
      .orderBy(
        sortOrder === 'desc'
          ? orderCol
          : asc(orderCol as Parameters<typeof asc>[0]),
      )
      .limit(limit)
      .offset((page - 1) * limit);

    const ids = rows.map((r) => r.id);
    const values =
      ids.length > 0
        ? await this.database
            .select()
            .from(estimateTemplateValue)
            .where(inArray(estimateTemplateValue.templateId, ids))
            .orderBy(asc(estimateTemplateValue.order))
        : [];

    return {
      templates: rows.map((r) => ({
        ...r,
        organizationName: r.organizationName ?? null,
        color: r.color ?? null,
        values: values.filter((v) => v.templateId === r.id),
      })),
      total: totalRow?.total ?? 0,
      page,
      limit,
    };
  }

  async getTemplateById(id: string): Promise<EstimateTemplateWithValues> {
    const [tmpl] = await this.database
      .select({
        id: estimateTemplate.id,
        name: estimateTemplate.name,
        description: estimateTemplate.description,
        isBuiltIn: estimateTemplate.isBuiltIn,
        organizationId: estimateTemplate.organizationId,
        color: estimateTemplate.color,
        createdAt: estimateTemplate.createdAt,
        updatedAt: estimateTemplate.updatedAt,
        organizationName: orgSchema.organization.name,
      })
      .from(estimateTemplate)
      .leftJoin(
        orgSchema.organization,
        eq(estimateTemplate.organizationId, orgSchema.organization.id),
      )
      .where(eq(estimateTemplate.id, id))
      .limit(1);

    if (!tmpl) throw new NotFoundException('Estimate template not found');

    const values = await this.database
      .select()
      .from(estimateTemplateValue)
      .where(eq(estimateTemplateValue.templateId, id))
      .orderBy(asc(estimateTemplateValue.order));

    return {
      ...tmpl,
      organizationName: tmpl.organizationName ?? null,
      color: tmpl.color ?? null,
      values,
    };
  }

  async createTemplate(
    userId: string,
    data: CreateEstimateTemplateBody,
  ): Promise<{ id: string }> {
    await this.assertAccess(userId, data.organizationId ?? null);

    const id = generateId();

    await this.database.insert(estimateTemplate).values({
      id,
      name: data.name,
      description: data.description ?? null,
      organizationId: data.organizationId ?? null,
      color: data.color ?? null,
      isBuiltIn: false,
    });

    await this.database.insert(estimateTemplateValue).values(
      data.values.map((v, index) => ({
        id: generateId(),
        templateId: id,
        label: v.label,
        value: v.value,
        order: v.order ?? index,
        color: v.color ?? null,
        description: v.description ?? null,
      })),
    );

    return { id };
  }

  async updateTemplate(
    userId: string,
    id: string,
    data: UpdateEstimateTemplateBody,
  ): Promise<{ id: string }> {
    const existing = await this.getTemplateById(id);
    await this.assertAccess(userId, existing.organizationId);

    const updateFields: Partial<typeof estimateTemplate.$inferInsert> = {};
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined)
      updateFields.description = data.description ?? null;
    if (data.color !== undefined) updateFields.color = data.color ?? null;

    if (Object.keys(updateFields).length > 0) {
      await this.database
        .update(estimateTemplate)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(eq(estimateTemplate.id, id));
    }

    if (data.values !== undefined) {
      await this.database
        .delete(estimateTemplateValue)
        .where(eq(estimateTemplateValue.templateId, id));

      await this.database.insert(estimateTemplateValue).values(
        data.values.map((v, index) => ({
          id: generateId(),
          templateId: id,
          label: v.label,
          value: v.value,
          order: v.order ?? index,
          color: v.color ?? null,
          description: v.description ?? null,
        })),
      );
    }

    return { id };
  }

  async deleteTemplate(userId: string, id: string): Promise<{ success: true }> {
    const existing = await this.getTemplateById(id);
    await this.assertAccess(userId, existing.organizationId);

    await this.database
      .delete(estimateTemplate)
      .where(eq(estimateTemplate.id, id));

    return { success: true };
  }

  async seedBuiltInTemplates(): Promise<{ seeded: number; skipped: number }> {
    let seeded = 0;
    let skipped = 0;

    for (const tmpl of BUILT_IN_ESTIMATE_TEMPLATES) {
      const [existing] = await this.database
        .select({ id: estimateTemplate.id })
        .from(estimateTemplate)
        .where(eq(estimateTemplate.id, tmpl.id))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      const [existingByName] = await this.database
        .select({ id: estimateTemplate.id })
        .from(estimateTemplate)
        .where(
          and(
            ilike(estimateTemplate.name, tmpl.name),
            eq(estimateTemplate.isBuiltIn, true),
          ),
        )
        .limit(1);

      if (existingByName) {
        skipped++;
        continue;
      }

      await this.database.insert(estimateTemplate).values({
        id: tmpl.id,
        name: tmpl.name,
        description: tmpl.description,
        isBuiltIn: true,
        organizationId: null,
        color: tmpl.color ?? null,
      });

      await this.database.insert(estimateTemplateValue).values(
        tmpl.values.map((v) => ({
          id: generateId(),
          templateId: tmpl.id,
          label: v.label,
          value: v.value,
          order: v.order,
          color: v.color ?? null,
          description: v.description ?? null,
        })),
      );

      seeded++;
    }

    return { seeded, skipped };
  }
}
