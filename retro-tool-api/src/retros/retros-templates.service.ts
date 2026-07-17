import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  eq,
  and,
  asc,
  desc,
  inArray,
  count,
  or,
  ilike,
  type SQL,
} from 'drizzle-orm';
import * as retroSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { Template, TemplateColumn } from './schema';
import { CreateTemplateDto } from './dtos/create-template.dto';
import { UpdateTemplateDto } from './dtos/update-template.dto';
import { BUILT_IN_TEMPLATES } from '../common/data/built-in-templates';
import {
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
} from '../common/enums';
import { generateId } from '../lib/utils';
import type {
  TemplateDeleteResult,
  TemplateMutationResult,
  TemplateSeedResult,
} from './types';

type Database = NodePgDatabase<
  typeof retroSchema & typeof teamSchema & typeof authSchema & typeof orgSchema
>;

/**
 * Retro template CRUD + access control + built-in seeding. Split out of
 * RetrosService (which was ~3,000 lines) since templates are a self-contained
 * concern with no dependency on the retro lifecycle, notifications, or email.
 */
@Injectable()
export class RetrosTemplatesService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
  ) {}

  private async invalidateTemplateCaches(templateId?: string): Promise<void> {
    void templateId;
    await Promise.resolve();
  }

  async getTemplates(
    userId: string,
  ): Promise<(Template & { organizationName: string | null })[]> {
    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const isSystemAdmin =
      fullUser?.role === USER_ROLES.SuperAdmin ||
      fullUser?.role === USER_ROLES.SystemAdmin;

    if (isSystemAdmin) {
      return this.database
        .select({
          id: retroSchema.template.id,
          name: retroSchema.template.name,
          description: retroSchema.template.description,
          isBuiltIn: retroSchema.template.isBuiltIn,
          organizationId: retroSchema.template.organizationId,
          createdAt: retroSchema.template.createdAt,
          updatedAt: retroSchema.template.updatedAt,
          organizationName: orgSchema.organization.name,
        })
        .from(retroSchema.template)
        .leftJoin(
          orgSchema.organization,
          eq(retroSchema.template.organizationId, orgSchema.organization.id),
        );
    }

    const memberships = await this.database
      .select({ organizationId: orgSchema.organizationMember.organizationId })
      .from(orgSchema.organizationMember)
      .where(eq(orgSchema.organizationMember.userId, userId));

    const orgIds = memberships.map((m) => m.organizationId);

    const templates = await this.database
      .select({
        id: retroSchema.template.id,
        name: retroSchema.template.name,
        description: retroSchema.template.description,
        isBuiltIn: retroSchema.template.isBuiltIn,
        organizationId: retroSchema.template.organizationId,
        createdAt: retroSchema.template.createdAt,
        updatedAt: retroSchema.template.updatedAt,
        organizationName: orgSchema.organization.name,
      })
      .from(retroSchema.template)
      .leftJoin(
        orgSchema.organization,
        eq(retroSchema.template.organizationId, orgSchema.organization.id),
      )
      .where(eq(retroSchema.template.isBuiltIn, true));

    const orgTemplates =
      orgIds.length > 0
        ? await this.database
            .select({
              id: retroSchema.template.id,
              name: retroSchema.template.name,
              description: retroSchema.template.description,
              isBuiltIn: retroSchema.template.isBuiltIn,
              organizationId: retroSchema.template.organizationId,
              createdAt: retroSchema.template.createdAt,
              updatedAt: retroSchema.template.updatedAt,
              organizationName: orgSchema.organization.name,
            })
            .from(retroSchema.template)
            .leftJoin(
              orgSchema.organization,
              eq(
                retroSchema.template.organizationId,
                orgSchema.organization.id,
              ),
            )
            .where(inArray(retroSchema.template.organizationId, orgIds))
        : [];

    return [...templates, ...orgTemplates];
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
    templates: (Template & {
      columns: TemplateColumn[];
      organizationName: string | null;
    })[];
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

    // Type filter
    if (type === 'built-in') {
      conditions.push(eq(retroSchema.template.isBuiltIn, true));
    } else if (type === 'organization') {
      conditions.push(eq(retroSchema.template.isBuiltIn, false));
    }

    // Access control: non-admins can only see built-in + their own orgs
    if (!isAdmin) {
      const memberships = await this.database
        .select({ organizationId: orgSchema.organizationMember.organizationId })
        .from(orgSchema.organizationMember)
        .where(eq(orgSchema.organizationMember.userId, userId));

      const orgIds = memberships.map((m) => m.organizationId);

      if (type === 'built-in') {
        // Already filtered to built-in above, no extra condition needed
      } else if (type === 'organization') {
        // Only show org templates from user's orgs
        if (orgIds.length > 0) {
          conditions.push(inArray(retroSchema.template.organizationId, orgIds));
        } else {
          // User has no orgs — return empty
          return { templates: [], total: 0, page, limit };
        }
      } else {
        // No type filter — show built-in + user's org templates
        if (orgIds.length > 0) {
          conditions.push(
            or(
              eq(retroSchema.template.isBuiltIn, true),
              inArray(retroSchema.template.organizationId, orgIds),
            )!,
          );
        } else {
          conditions.push(eq(retroSchema.template.isBuiltIn, true));
        }
      }
    }

    if (normalizedSearch) {
      conditions.push(
        ilike(retroSchema.template.name, `%${normalizedSearch}%`),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await this.database
      .select({ total: count() })
      .from(retroSchema.template)
      .where(whereClause);

    const rows = await this.database
      .select({
        id: retroSchema.template.id,
        name: retroSchema.template.name,
        description: retroSchema.template.description,
        isBuiltIn: retroSchema.template.isBuiltIn,
        organizationId: retroSchema.template.organizationId,
        createdAt: retroSchema.template.createdAt,
        updatedAt: retroSchema.template.updatedAt,
        organizationName: orgSchema.organization.name,
      })
      .from(retroSchema.template)
      .leftJoin(
        orgSchema.organization,
        eq(retroSchema.template.organizationId, orgSchema.organization.id),
      )
      .where(whereClause)
      .orderBy(
        sortOrder === 'desc'
          ? desc(
              sort === 'createdAt'
                ? retroSchema.template.createdAt
                : retroSchema.template.name,
            )
          : asc(
              sort === 'createdAt'
                ? retroSchema.template.createdAt
                : retroSchema.template.name,
            ),
      )
      .limit(limit)
      .offset((page - 1) * limit);

    const ids = rows.map((r) => r.id);
    const columns =
      ids.length > 0
        ? await this.database
            .select()
            .from(retroSchema.templateColumn)
            .where(inArray(retroSchema.templateColumn.templateId, ids))
            .orderBy(retroSchema.templateColumn.order)
        : [];

    return {
      templates: rows.map((r) => ({
        ...r,
        columns: columns.filter((c) => c.templateId === r.id),
      })),
      total: totalRow?.total ?? 0,
      page,
      limit,
    };
  }

  async getTemplateById(
    templateId: string,
  ): Promise<(Template & { columns: TemplateColumn[] }) | null> {
    const [tmpl] = await this.database
      .select()
      .from(retroSchema.template)
      .where(eq(retroSchema.template.id, templateId))
      .limit(1);

    if (!tmpl) return null;

    const columns = await this.database
      .select()
      .from(retroSchema.templateColumn)
      .where(eq(retroSchema.templateColumn.templateId, templateId))
      .orderBy(retroSchema.templateColumn.order);

    return { ...tmpl, columns };
  }

  private async assertTemplateAccess(
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

    if (organizationId) {
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

      // Team leads within this org can also manage org retro templates
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

      if (!teamLeadship) {
        throw new ForbiddenException(
          'Only organization admins or team leads can manage organization templates',
        );
      }
    } else {
      if (!isSystemAdmin) {
        throw new ForbiddenException(
          'Only system admins can manage global templates',
        );
      }
    }
  }

  async createTemplate(
    userId: string,
    data: CreateTemplateDto,
  ): Promise<TemplateMutationResult> {
    await this.assertTemplateAccess(userId, data.organizationId);

    const id = generateId();

    await this.database.insert(retroSchema.template).values({
      id,
      name: data.name,
      description: data.description ?? null,
      organizationId: data.organizationId ?? null,
      isBuiltIn: false,
    });

    await this.database.insert(retroSchema.templateColumn).values(
      data.columns.map((column, index) => ({
        id: generateId(),
        templateId: id,
        name: column.name,
        emoji: column.emoji ?? null,
        prompt: column.prompt ?? null,
        order: column.order ?? index,
      })),
    );

    await this.invalidateTemplateCaches(id);

    return { id };
  }

  async updateTemplate(
    userId: string,
    templateId: string,
    data: UpdateTemplateDto,
  ): Promise<TemplateMutationResult> {
    const [existing] = await this.database
      .select({
        id: retroSchema.template.id,
        organizationId: retroSchema.template.organizationId,
        isBuiltIn: retroSchema.template.isBuiltIn,
      })
      .from(retroSchema.template)
      .where(eq(retroSchema.template.id, templateId))
      .limit(1);

    if (!existing) throw new NotFoundException('Template not found');

    await this.assertTemplateAccess(userId, existing.organizationId);

    await this.database
      .update(retroSchema.template)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description ?? null,
        }),
        ...(data.organizationId !== undefined && {
          organizationId: data.organizationId ?? null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(retroSchema.template.id, templateId));

    if (data.columns) {
      const existingColumns = await this.database
        .select()
        .from(retroSchema.templateColumn)
        .where(eq(retroSchema.templateColumn.templateId, templateId))
        .orderBy(retroSchema.templateColumn.order);

      for (let i = 0; i < data.columns.length; i++) {
        const col = data.columns[i];
        const existing = existingColumns[i];

        if (existing) {
          await this.database
            .update(retroSchema.templateColumn)
            .set({
              name: col.name,
              emoji: col.emoji ?? null,
              prompt: col.prompt ?? null,
              order: col.order ?? i,
            })
            .where(eq(retroSchema.templateColumn.id, existing.id));
        } else {
          await this.database.insert(retroSchema.templateColumn).values({
            id: generateId(),
            templateId,
            name: col.name,
            emoji: col.emoji ?? null,
            prompt: col.prompt ?? null,
            order: col.order ?? i,
          });
        }
      }

      if (existingColumns.length > data.columns.length) {
        const toDeleteIds = existingColumns
          .slice(data.columns.length)
          .map((c) => c.id);

        const [referenced] = await this.database
          .select({ count: count() })
          .from(retroSchema.card)
          .where(inArray(retroSchema.card.columnId, toDeleteIds));

        if ((referenced?.count ?? 0) > 0) {
          throw new BadRequestException(
            'Cannot remove columns that still have cards. Delete the cards first.',
          );
        }

        await this.database
          .delete(retroSchema.templateColumn)
          .where(inArray(retroSchema.templateColumn.id, toDeleteIds));
      }
    }

    await this.invalidateTemplateCaches(templateId);
    return { id: templateId };
  }

  async deleteTemplate(
    userId: string,
    templateId: string,
  ): Promise<TemplateDeleteResult> {
    const [existing] = await this.database
      .select({
        id: retroSchema.template.id,
        organizationId: retroSchema.template.organizationId,
        isBuiltIn: retroSchema.template.isBuiltIn,
      })
      .from(retroSchema.template)
      .where(eq(retroSchema.template.id, templateId))
      .limit(1);

    if (!existing) throw new NotFoundException('Template not found');

    await this.assertTemplateAccess(userId, existing.organizationId);

    const [inUse] = await this.database
      .select({ count: count() })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.templateId, templateId));

    if ((inUse?.count ?? 0) > 0) {
      throw new BadRequestException(
        'Cannot delete a template that is used by retrospectives',
      );
    }

    await this.database
      .delete(retroSchema.template)
      .where(eq(retroSchema.template.id, templateId));

    await this.invalidateTemplateCaches(templateId);

    return { success: true };
  }

  async seedBuiltInTemplates(): Promise<TemplateSeedResult> {
    const existing = await this.database
      .select({ id: retroSchema.template.id, name: retroSchema.template.name })
      .from(retroSchema.template);

    const existingIds = new Set(existing.map((t) => t.id));
    const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));

    let added = 0;

    for (const tmpl of BUILT_IN_TEMPLATES) {
      if (
        existingIds.has(tmpl.id) ||
        existingNames.has(tmpl.name.toLowerCase())
      ) {
        continue;
      }

      await this.database.insert(retroSchema.template).values({
        id: tmpl.id,
        name: tmpl.name,
        description: tmpl.description,
        isBuiltIn: true,
      });

      for (const col of tmpl.columns) {
        await this.database.insert(retroSchema.templateColumn).values({
          id: generateId(),
          templateId: tmpl.id,
          ...col,
        });
      }

      added++;
    }

    await this.invalidateTemplateCaches();

    return {
      message:
        added > 0
          ? `Seeded ${added} template(s) successfully`
          : 'All templates already exist',
    };
  }
}
