import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as retroSchema from '../retros/schema';
import * as teamSchema from '../teams/schema';
import { generateId } from '../lib/utils';
import { CreateActionItemDto, UpdateActionItemDto } from './dto';
import { RetrosProjectionSyncService } from '../retros/retros-projection-sync.service';
import {
  ACTION_ITEM_STATUSES,
  RETRO_STATUSES,
  type TActionItemStatus,
} from '../common/enums';

type Database = NodePgDatabase<typeof retroSchema & typeof teamSchema>;

@Injectable()
export class ActionItemsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly retrosProjectionSyncService: RetrosProjectionSyncService,
  ) {}

  async createActionItem(userId: string, dto: CreateActionItemDto) {
    const [retro] = await this.database
      .select({
        id: retroSchema.retrospective.id,
        teamId: retroSchema.retrospective.teamId,
      })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, dto.retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const isMember = await this.isTeamMember(userId, retro.teamId);
    if (!isMember) throw new ForbiddenException('Not a team member');

    const id = generateId();
    const status = (dto.status ??
      ACTION_ITEM_STATUSES.Pending) as TActionItemStatus;
    const [created] = await this.database
      .insert(retroSchema.actionItem)
      .values({
        id,
        retroId: dto.retroId,
        cardId: dto.cardId,
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      })
      .returning();

    await this.emitRetroUpdatesForActionItem(dto.retroId);

    return created;
  }

  async getActionItems(userId: string, retroId: string) {
    const [retro] = await this.database
      .select({
        id: retroSchema.retrospective.id,
        teamId: retroSchema.retrospective.teamId,
      })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const isMember = await this.isTeamMember(userId, retro.teamId);
    if (!isMember) throw new ForbiddenException('Not a team member');

    return this.database
      .select()
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.retroId, retroId))
      .orderBy(desc(retroSchema.actionItem.createdAt));
  }

  async getActionItem(userId: string, actionItemId: string) {
    const [item] = await this.database
      .select()
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.id, actionItemId))
      .limit(1);

    if (!item) throw new NotFoundException('Action item not found');

    const [retro] = await this.database
      .select({ teamId: retroSchema.retrospective.teamId })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, item.retroId))
      .limit(1);

    const isMember = retro
      ? await this.isTeamMember(userId, retro.teamId)
      : false;
    if (!isMember) throw new ForbiddenException('Not a team member');

    return item;
  }

  async updateActionItem(
    userId: string,
    actionItemId: string,
    dto: UpdateActionItemDto,
  ) {
    const [item] = await this.database
      .select()
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.id, actionItemId))
      .limit(1);

    if (!item) throw new NotFoundException('Action item not found');

    const [retro] = await this.database
      .select({
        teamId: retroSchema.retrospective.teamId,
      })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, item.retroId))
      .limit(1);

    const isMember = retro
      ? await this.isTeamMember(userId, retro.teamId)
      : false;
    if (!isMember) throw new ForbiddenException('Not a team member');

    const status = (dto.status ?? undefined) as TActionItemStatus | undefined;
    const [updated] = await this.database
      .update(retroSchema.actionItem)
      .set({
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(retroSchema.actionItem.id, actionItemId))
      .returning();

    // If the action item is now completed, clear currentDiscussionActionItemId
    // on ANY retro that has this item as the current discussion
    // (needed for carried-forward items discussed in a different retro)
    if (dto.status === ACTION_ITEM_STATUSES.Completed) {
      await this.database
        .update(retroSchema.retrospective)
        .set({
          currentDiscussionActionItemId: null,
          updatedAt: new Date(),
        })
        .where(
          eq(
            retroSchema.retrospective.currentDiscussionActionItemId,
            actionItemId,
          ),
        );
    }

    await this.emitRetroUpdatesForActionItem(item.retroId);

    return updated;
  }

  async deleteActionItem(userId: string, actionItemId: string) {
    const [item] = await this.database
      .select()
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.id, actionItemId))
      .limit(1);

    if (!item) throw new NotFoundException('Action item not found');

    const [retro] = await this.database
      .select({ teamId: retroSchema.retrospective.teamId })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, item.retroId))
      .limit(1);

    const isMember = retro
      ? await this.isTeamMember(userId, retro.teamId)
      : false;
    if (!isMember) throw new ForbiddenException('Not a team member');

    await this.database
      .delete(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.id, actionItemId));

    await this.emitRetroUpdatesForActionItem(item.retroId);
  }

  async createActionItemComment(
    userId: string,
    actionItemId: string,
    content: string,
  ) {
    const trimmedContent = (content ?? '').trim();
    if (!trimmedContent) {
      throw new BadRequestException('Comment content is required');
    }

    const [item] = await this.database
      .select()
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.id, actionItemId))
      .limit(1);

    if (!item) throw new NotFoundException('Action item not found');

    const [retro] = await this.database
      .select({ teamId: retroSchema.retrospective.teamId })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, item.retroId))
      .limit(1);

    const isMember = retro
      ? await this.isTeamMember(userId, retro.teamId)
      : false;
    if (!isMember) throw new ForbiddenException('Not a team member');

    const id = generateId();
    const [created] = await this.database
      .insert(retroSchema.actionItemComment)
      .values({
        id,
        actionItemId,
        authorId: userId,
        content: trimmedContent,
      })
      .returning();

    await this.emitRetroUpdatesForActionItem(item.retroId);

    return created;
  }

  async deleteActionItemComment(userId: string, commentId: string) {
    const [comment] = await this.database
      .select()
      .from(retroSchema.actionItemComment)
      .where(eq(retroSchema.actionItemComment.id, commentId))
      .limit(1);

    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.database
      .delete(retroSchema.actionItemComment)
      .where(eq(retroSchema.actionItemComment.id, commentId));

    const [item] = await this.database
      .select({ retroId: retroSchema.actionItem.retroId })
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.id, comment.actionItemId))
      .limit(1);
    if (item?.retroId) {
      await this.emitRetroUpdatesForActionItem(item.retroId);
    }

    return { success: true };
  }

  async likeActionItem(userId: string, actionItemId: string) {
    const [item] = await this.database
      .select()
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.id, actionItemId))
      .limit(1);

    if (!item) throw new NotFoundException('Action item not found');

    const [retro] = await this.database
      .select({ teamId: retroSchema.retrospective.teamId })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, item.retroId))
      .limit(1);

    const isMember = retro
      ? await this.isTeamMember(userId, retro.teamId)
      : false;
    if (!isMember) throw new ForbiddenException('Not a team member');

    const [existing] = await this.database
      .select({ id: retroSchema.actionItemLike.id })
      .from(retroSchema.actionItemLike)
      .where(
        and(
          eq(retroSchema.actionItemLike.actionItemId, actionItemId),
          eq(retroSchema.actionItemLike.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      await this.database.insert(retroSchema.actionItemLike).values({
        id: generateId(),
        actionItemId,
        userId,
      });
    }

    await this.emitRetroUpdatesForActionItem(item.retroId);

    return { success: true };
  }

  async unlikeActionItem(userId: string, actionItemId: string) {
    const [item] = await this.database
      .select()
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.id, actionItemId))
      .limit(1);

    if (!item) throw new NotFoundException('Action item not found');

    const [retro] = await this.database
      .select({ teamId: retroSchema.retrospective.teamId })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, item.retroId))
      .limit(1);

    const isMember = retro
      ? await this.isTeamMember(userId, retro.teamId)
      : false;
    if (!isMember) throw new ForbiddenException('Not a team member');

    await this.database
      .delete(retroSchema.actionItemLike)
      .where(
        and(
          eq(retroSchema.actionItemLike.actionItemId, actionItemId),
          eq(retroSchema.actionItemLike.userId, userId),
        ),
      );

    await this.emitRetroUpdatesForActionItem(item.retroId);

    return { success: true };
  }

  private async isTeamMember(userId: string, teamId: string): Promise<boolean> {
    const [row] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);
    return !!row;
  }

  private async emitRetroUpdatesForActionItem(retroId: string): Promise<void> {
    // Always re-project the retro that owns the action item
    await this.retrosProjectionSyncService.enqueueRetroSync(retroId);

    const [retro] = await this.database
      .select({
        teamId: retroSchema.retrospective.teamId,
      })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) return;

    // Find retros that display the "Carried from Previous Retro" section.
    // Use team + status only to avoid missing peers due to timestamp ordering.
    const relatedRetros = await this.database
      .select({ id: retroSchema.retrospective.id })
      .from(retroSchema.retrospective)
      .where(
        and(
          eq(retroSchema.retrospective.teamId, retro.teamId),
          inArray(retroSchema.retrospective.status, [
            RETRO_STATUSES.Discussing,
            RETRO_STATUSES.Completed,
          ]),
        ),
      );

    for (const { id } of relatedRetros) {
      if (id === retroId) continue;
      await this.retrosProjectionSyncService.enqueueRetroSync(id);
    }
  }
}
