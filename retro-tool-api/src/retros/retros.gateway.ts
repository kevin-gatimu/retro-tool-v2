import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as authSchema from '../auth/schema';
import { eq } from 'drizzle-orm';
import type { ClientData, WsSessionData } from '../common/types';
import { RetrosProjectionSyncService } from './retros-projection-sync.service';

type Database = NodePgDatabase<typeof authSchema>;

@WebSocketGateway({
  namespace: '/retros',
})
export class RetrosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RetrosGateway.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly retrosProjectionSyncService: RetrosProjectionSyncService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const cookieHeader = client.handshake.headers.cookie ?? '';
      const token = this.extractToken(cookieHeader);

      if (!token) {
        client.disconnect();
        return;
      }

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

      const sessionData: WsSessionData = {
        userId: session.userId,
        expiresAt: session.expiresAt.toISOString(),
      };

      (client.data as ClientData).userId = sessionData.userId;
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

  @SubscribeMessage('join-retro')
  async handleJoinRetro(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { retroId: string },
  ): Promise<void> {
    if (!data?.retroId) return;
    await client.join(`retro:${data.retroId}`);
  }

  @SubscribeMessage('leave-retro')
  async handleLeaveRetro(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { retroId: string },
  ): Promise<void> {
    if (!data?.retroId) return;
    await client.leave(`retro:${data.retroId}`);
  }

  emitRetroChanged(retroId: string): void {
    this.server.to(`retro:${retroId}`).emit('retro-changed', { retroId });
    void this.retrosProjectionSyncService.syncRetroProjection(retroId);
  }

  emitRetroStatusChanged(
    retroId: string,
    status:
      | 'waiting'
      | 'active'
      | 'grouping'
      | 'voting'
      | 'discussing'
      | 'completed',
  ): void {
    this.server
      .to(`retro:${retroId}`)
      .emit('retro-changed', { retroId, status });
    void this.retrosProjectionSyncService.syncRetroProjection(retroId);
  }

  emitDiscussionCardChanged(retroId: string, cardId: string): void {
    this.server
      .to(`retro:${retroId}`)
      .emit('discussion-card-changed', { retroId, cardId });
    void this.retrosProjectionSyncService.syncRetroProjection(retroId);
  }

  emitDiscussionActionItemChanged(retroId: string, actionItemId: string): void {
    this.server
      .to(`retro:${retroId}`)
      .emit('discussion-action-item-changed', { retroId, actionItemId });
    void this.retrosProjectionSyncService.syncRetroProjection(retroId);
  }

  emitCarriedForwardChanged(retroId: string, actionItemId?: string): void {
    this.server
      .to(`retro:${retroId}`)
      .emit('carried-forward-changed', { retroId, actionItemId });
    void this.retrosProjectionSyncService.syncRetroProjection(retroId);
  }

  emitRetroListChanged(): void {
    this.server.emit('retro-list-changed');
  }

  private extractToken(cookieHeader: string): string | null {
    const match = cookieHeader.match(
      /(?:^|;\s*)better-auth\.session_token=([^;]+)/,
    );
    return match ? decodeURIComponent(match[1]) : null;
  }
}
