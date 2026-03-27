import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as authSchema from '../auth/schema';
import { eq } from 'drizzle-orm';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache-keys';
import type { ClientData, WsSessionData } from '../common/types';

type Database = NodePgDatabase<typeof authSchema>;

@WebSocketGateway({
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly cacheService: CacheService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const cookieHeader = client.handshake.headers.cookie ?? '';
      const token = this.extractToken(cookieHeader);

      if (!token) {
        client.disconnect();
        return;
      }

      const cacheKey = CacheKeys.wsSession(token);
      let sessionData = await this.cacheService.get<WsSessionData>(cacheKey);

      if (!sessionData) {
        const [session] = await this.database
          .select({
            userId: authSchema.session.userId,
            expiresAt: authSchema.session.expiresAt,
          })
          .from(authSchema.session)
          .where(eq(authSchema.session.token, token))
          .limit(1);

        if (!session || session.expiresAt < new Date()) {
          client.disconnect();
          return;
        }

        sessionData = {
          userId: session.userId,
          expiresAt: session.expiresAt.toISOString(),
        };
        await this.cacheService.set(cacheKey, sessionData, 300);
      } else if (new Date(sessionData.expiresAt) < new Date()) {
        client.disconnect();
        return;
      }

      (client.data as ClientData).userId = sessionData.userId;
      await client.join(`user:${sessionData.userId}`);
      this.logger.log(`Client connected: userId=${sessionData.userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const { userId } = client.data as ClientData;
    if (userId) {
      this.logger.log(`Client disconnected: userId=${userId}`);
    }
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  private extractToken(cookieHeader: string): string | null {
    // better-auth uses 'better-auth.session_token' cookie
    const match = cookieHeader.match(
      /(?:^|;\s*)better-auth\.session_token=([^;]+)/,
    );
    return match ? decodeURIComponent(match[1]) : null;
  }
}
