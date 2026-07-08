import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray, count, ilike, or, asc, type SQL } from 'drizzle-orm';
import { icebreakerTemplate, icebreakerPrompt } from '../icebreakers/schema';
import * as icebreakersSchema from '../icebreakers/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import * as teamSchema from '../teams/schema';
import { generateId } from '../lib/utils';
import {
  USER_ROLES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  type TIcebreakerFlavour,
} from '../common/enums';
import { BUILT_IN_ICEBREAKER_TEMPLATES } from '../common/data/built-in-icebreaker-templates';
import type {
  CreateIcebreakerTemplateBody,
  UpdateIcebreakerTemplateBody,
} from './dtos';
import type { IcebreakerTemplateWithPrompts } from './types';

type Database = NodePgDatabase<
  typeof icebreakersSchema &
    typeof authSchema &
    typeof orgSchema &
    typeof teamSchema
>;

export type { IcebreakerTemplateWithPrompts };

@Injectable()
export class IcebreakerTemplatesService {
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
          'Only system admins can manage global icebreaker templates',
        );
      }
      return;
    }

    if (isSystemAdmin) return;

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
      'Only organization admins or team leads can manage org icebreaker templates',
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
    flavour?: TIcebreakerFlavour,
  ): Promise<{
    templates: IcebreakerTemplateWithPrompts[];
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
      conditions.push(eq(icebreakerTemplate.isBuiltIn, true));
    } else if (type === 'organization') {
      conditions.push(eq(icebreakerTemplate.isBuiltIn, false));
    }

    if (flavour) {
      conditions.push(eq(icebreakerTemplate.flavour, flavour));
    }

    if (!isAdmin) {
      const memberships = await this.database
        .select({ organizationId: orgSchema.organizationMember.organizationId })
        .from(orgSchema.organizationMember)
        .where(eq(orgSchema.organizationMember.userId, userId));

      const orgIds = memberships.map((m) => m.organizationId);

      if (type === 'organization') {
        if (orgIds.length > 0) {
          conditions.push(inArray(icebreakerTemplate.organizationId, orgIds));
        } else {
          return { templates: [], total: 0, page, limit };
        }
      } else if (type !== 'built-in') {
        if (orgIds.length > 0) {
          conditions.push(
            or(
              eq(icebreakerTemplate.isBuiltIn, true),
              inArray(icebreakerTemplate.organizationId, orgIds),
            )!,
          );
        } else {
          conditions.push(eq(icebreakerTemplate.isBuiltIn, true));
        }
      }
    }

    if (normalizedSearch) {
      conditions.push(ilike(icebreakerTemplate.name, `%${normalizedSearch}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await this.database
      .select({ total: count() })
      .from(icebreakerTemplate)
      .where(whereClause);

    const orderCol =
      sort === 'createdAt'
        ? icebreakerTemplate.createdAt
        : sort === 'name'
          ? icebreakerTemplate.name
          : icebreakerTemplate.id;

    const rows = await this.database
      .select({
        id: icebreakerTemplate.id,
        name: icebreakerTemplate.name,
        description: icebreakerTemplate.description,
        flavour: icebreakerTemplate.flavour,
        isBuiltIn: icebreakerTemplate.isBuiltIn,
        organizationId: icebreakerTemplate.organizationId,
        color: icebreakerTemplate.color,
        createdAt: icebreakerTemplate.createdAt,
        updatedAt: icebreakerTemplate.updatedAt,
        organizationName: orgSchema.organization.name,
      })
      .from(icebreakerTemplate)
      .leftJoin(
        orgSchema.organization,
        eq(icebreakerTemplate.organizationId, orgSchema.organization.id),
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
    const prompts =
      ids.length > 0
        ? await this.database
            .select()
            .from(icebreakerPrompt)
            .where(inArray(icebreakerPrompt.templateId, ids))
            .orderBy(asc(icebreakerPrompt.order))
        : [];

    return {
      templates: rows.map((r) => ({
        ...r,
        organizationName: r.organizationName ?? null,
        color: r.color ?? null,
        prompts: prompts
          .filter((p) => p.templateId === r.id)
          .map((p) => ({
            id: p.id,
            templateId: p.templateId,
            text: p.text,
            order: p.order,
            color: p.color ?? null,
          })),
      })),
      total: totalRow?.total ?? 0,
      page,
      limit,
    };
  }

  async getTemplateById(id: string): Promise<IcebreakerTemplateWithPrompts> {
    const [tmpl] = await this.database
      .select({
        id: icebreakerTemplate.id,
        name: icebreakerTemplate.name,
        description: icebreakerTemplate.description,
        flavour: icebreakerTemplate.flavour,
        isBuiltIn: icebreakerTemplate.isBuiltIn,
        organizationId: icebreakerTemplate.organizationId,
        color: icebreakerTemplate.color,
        createdAt: icebreakerTemplate.createdAt,
        updatedAt: icebreakerTemplate.updatedAt,
        organizationName: orgSchema.organization.name,
      })
      .from(icebreakerTemplate)
      .leftJoin(
        orgSchema.organization,
        eq(icebreakerTemplate.organizationId, orgSchema.organization.id),
      )
      .where(eq(icebreakerTemplate.id, id))
      .limit(1);

    if (!tmpl) throw new NotFoundException('Icebreaker template not found');

    const prompts = await this.database
      .select()
      .from(icebreakerPrompt)
      .where(eq(icebreakerPrompt.templateId, id))
      .orderBy(asc(icebreakerPrompt.order));

    return {
      ...tmpl,
      organizationName: tmpl.organizationName ?? null,
      color: tmpl.color ?? null,
      prompts: prompts.map((p) => ({
        id: p.id,
        templateId: p.templateId,
        text: p.text,
        order: p.order,
        color: p.color ?? null,
      })),
    };
  }

  async createTemplate(
    userId: string,
    data: CreateIcebreakerTemplateBody,
  ): Promise<{ id: string }> {
    await this.assertAccess(userId, data.organizationId ?? null);

    const id = generateId();

    await this.database.insert(icebreakerTemplate).values({
      id,
      name: data.name,
      description: data.description ?? null,
      flavour: data.flavour,
      organizationId: data.organizationId ?? null,
      color: data.color ?? null,
      isBuiltIn: false,
    });

    await this.database.insert(icebreakerPrompt).values(
      data.prompts.map((p, index) => ({
        id: generateId(),
        templateId: id,
        text: p.text,
        order: p.order ?? index,
        color: p.color ?? null,
      })),
    );

    return { id };
  }

  async updateTemplate(
    userId: string,
    id: string,
    data: UpdateIcebreakerTemplateBody,
  ): Promise<{ id: string }> {
    const existing = await this.getTemplateById(id);
    await this.assertAccess(userId, existing.organizationId);

    const updateFields: Partial<typeof icebreakerTemplate.$inferInsert> = {};
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined)
      updateFields.description = data.description ?? null;
    if (data.flavour !== undefined) updateFields.flavour = data.flavour;
    if (data.color !== undefined) updateFields.color = data.color ?? null;

    if (Object.keys(updateFields).length > 0) {
      await this.database
        .update(icebreakerTemplate)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(eq(icebreakerTemplate.id, id));
    }

    if (data.prompts !== undefined) {
      await this.database
        .delete(icebreakerPrompt)
        .where(eq(icebreakerPrompt.templateId, id));

      await this.database.insert(icebreakerPrompt).values(
        data.prompts.map((p, index) => ({
          id: generateId(),
          templateId: id,
          text: p.text,
          order: p.order ?? index,
          color: p.color ?? null,
        })),
      );
    }

    return { id };
  }

  async deleteTemplate(userId: string, id: string): Promise<{ success: true }> {
    const existing = await this.getTemplateById(id);
    await this.assertAccess(userId, existing.organizationId);

    await this.database
      .delete(icebreakerTemplate)
      .where(eq(icebreakerTemplate.id, id));

    return { success: true };
  }

  async seedBuiltInTemplates(): Promise<{ seeded: number; skipped: number }> {
    let seeded = 0;
    let skipped = 0;

    for (const tmpl of BUILT_IN_ICEBREAKER_TEMPLATES) {
      const [existing] = await this.database
        .select({ id: icebreakerTemplate.id })
        .from(icebreakerTemplate)
        .where(eq(icebreakerTemplate.id, tmpl.id))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      const [existingByName] = await this.database
        .select({ id: icebreakerTemplate.id })
        .from(icebreakerTemplate)
        .where(
          and(
            ilike(icebreakerTemplate.name, tmpl.name),
            eq(icebreakerTemplate.isBuiltIn, true),
          ),
        )
        .limit(1);

      if (existingByName) {
        skipped++;
        continue;
      }

      await this.database.insert(icebreakerTemplate).values({
        id: tmpl.id,
        name: tmpl.name,
        description: tmpl.description,
        flavour: tmpl.flavour,
        isBuiltIn: true,
        organizationId: null,
        color: tmpl.color ?? null,
      });

      await this.database.insert(icebreakerPrompt).values(
        tmpl.prompts.map((p) => ({
          id: generateId(),
          templateId: tmpl.id,
          text: p.text,
          order: p.order,
          color: p.color ?? null,
        })),
      );

      seeded++;
    }

    return { seeded, skipped };
  }
}
