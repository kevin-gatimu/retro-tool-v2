import { mutation, query } from './server'
import { v } from 'convex/values'

export const upsertNotificationProjection = mutation({
  args: {
    notificationId: v.string(),
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existingProjection = await ctx.db
      .query('liveNotifications')
      .withIndex('by_notification_id', (queryBuilder) =>
        queryBuilder.eq('notificationId', args.notificationId),
      )
      .unique()

    const nextProjection = {
      notificationId: args.notificationId,
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      read: args.read,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    }

    if (existingProjection) {
      await ctx.db.patch(existingProjection._id, nextProjection)
      return {
        notificationId: args.notificationId,
        operation: 'updated' as const,
      }
    }

    await ctx.db.insert('liveNotifications', nextProjection)
    return {
      notificationId: args.notificationId,
      operation: 'created' as const,
    }
  },
})

export const markNotificationReadProjection = mutation({
  args: {
    notificationId: v.string(),
    userId: v.string(),
    read: v.boolean(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existingProjection = await ctx.db
      .query('liveNotifications')
      .withIndex('by_notification_id', (queryBuilder) =>
        queryBuilder.eq('notificationId', args.notificationId),
      )
      .unique()

    if (!existingProjection || existingProjection.userId !== args.userId) {
      return {
        notificationId: args.notificationId,
        operation: 'noop' as const,
      }
    }

    await ctx.db.patch(existingProjection._id, {
      read: args.read,
      updatedAt: args.updatedAt,
    })

    return {
      notificationId: args.notificationId,
      operation: 'updated' as const,
    }
  },
})

export const markAllNotificationsReadProjection = mutation({
  args: {
    userId: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const projections = await ctx.db
      .query('liveNotifications')
      .withIndex('by_user_id', (queryBuilder) =>
        queryBuilder.eq('userId', args.userId),
      )
      .collect()

    let updatedCount = 0
    for (const projection of projections) {
      if (!projection.read) {
        await ctx.db.patch(projection._id, {
          read: true,
          updatedAt: args.updatedAt,
        })
        updatedCount += 1
      }
    }

    return {
      userId: args.userId,
      updatedCount,
    }
  },
})

export const listUserNotifications = query({
  args: {
    userId: v.string(),
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const projections = await ctx.db
      .query('liveNotifications')
      .withIndex('by_user_id', (queryBuilder) =>
        queryBuilder.eq('userId', args.userId),
      )
      .collect()

    const limit = args.limit ?? 50

    return projections
      .filter((projection) => (args.unreadOnly ? !projection.read : true))
      .sort((left, right) => {
        if (left.createdAt === right.createdAt) {
          return right.notificationId.localeCompare(left.notificationId)
        }
        return right.createdAt - left.createdAt
      })
      .slice(0, limit)
      .map((projection) => ({
        notificationId: projection.notificationId,
        userId: projection.userId,
        type: projection.type,
        title: projection.title,
        message: projection.message,
        link: projection.link,
        read: projection.read,
        createdAt: new Date(projection.createdAt).toISOString(),
        updatedAt: new Date(projection.updatedAt).toISOString(),
      }))
  },
})

export const getUnreadCount = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query('liveNotifications')
      .withIndex('by_user_read', (queryBuilder) =>
        queryBuilder.eq('userId', args.userId),
      )
      .filter((q) => q.eq(q.field('read'), false))
      .collect()

    return { count: unread.length }
  },
})