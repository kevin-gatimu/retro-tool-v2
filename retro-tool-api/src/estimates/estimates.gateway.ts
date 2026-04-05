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
import { EstimatesService } from './estimates.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';
import { NewEstimateRoundDto, UpdateEstimateStoryDto } from './dtos';
import type { ClientData, WsSessionData } from '../common/types';

type Database = NodePgDatabase<typeof authSchema>;

@WebSocketGateway({
  namespace: '/estimates',
})
export class EstimatesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EstimatesGateway.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly estimatesService: EstimatesService,
    private readonly estimatesProjectionSyncService: EstimatesProjectionSyncService,
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

  // ============================================================================
  // WebSocket Event Handlers
  // ============================================================================

  @SubscribeMessage('join-session')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    await this.estimatesService.upsertParticipant(data.sessionId, userId, true);
    await client.join(`session:${data.sessionId}`);

    const participant = await this.estimatesService.getParticipant(
      data.sessionId,
      userId,
    );
    this.server
      .to(`session:${data.sessionId}`)
      .emit('participant-joined', participant);
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('leave-session')
  async handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    await this.estimatesService.upsertParticipant(
      data.sessionId,
      userId,
      false,
    );
    await client.leave(`session:${data.sessionId}`);

    this.server
      .to(`session:${data.sessionId}`)
      .emit('participant-left', { userId });
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('cast-vote')
  async handleCastVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; points: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId || !data?.points) return;

    await this.estimatesService.upsertVote(data.sessionId, userId, data.points);

    // Emit that a vote was cast (without revealing the value)
    this.server
      .to(`session:${data.sessionId}`)
      .emit('vote-cast', { voterId: userId });
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('reveal-votes')
  async handleRevealVotes(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    const isCreator = await this.estimatesService.isSessionCreator(
      data.sessionId,
      userId,
    );
    if (!isCreator) return;

    const votes = await this.estimatesService.revealVotes(
      data.sessionId,
      userId,
    );
    this.server
      .to(`session:${data.sessionId}`)
      .emit('votes-revealed', { votes });
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('clear-votes')
  async handleClearVotes(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string } & NewEstimateRoundDto,
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    const isCreator = await this.estimatesService.isSessionCreator(
      data.sessionId,
      userId,
    );
    if (!isCreator) return;

    await this.estimatesService.clearVotes(data.sessionId, userId, {
      storyName: data.storyName,
      ticketNumber: data.ticketNumber,
      storyDescription: data.storyDescription,
      storyLink: data.storyLink,
    });
    this.server.to(`session:${data.sessionId}`).emit('votes-cleared');
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('start-round')
  async handleStartRound(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string } & NewEstimateRoundDto,
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    const isCreator = await this.estimatesService.isSessionCreator(
      data.sessionId,
      userId,
    );
    if (!isCreator) return;

    await this.estimatesService.startRound(data.sessionId, userId, {
      storyName: data.storyName,
      ticketNumber: data.ticketNumber,
      storyDescription: data.storyDescription,
      storyLink: data.storyLink,
    });
    this.server.to(`session:${data.sessionId}`).emit('round-started');
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('update-story')
  async handleUpdateStory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string } & UpdateEstimateStoryDto,
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    const isCreator = await this.estimatesService.isSessionCreator(
      data.sessionId,
      userId,
    );
    if (!isCreator) return;

    await this.estimatesService.updateStory(data.sessionId, userId, {
      storyName: data.storyName,
      ticketNumber: data.ticketNumber,
      storyDescription: data.storyDescription,
      storyLink: data.storyLink,
    });
    this.server.to(`session:${data.sessionId}`).emit('story-updated', {
      storyName: data.storyName,
      ticketNumber: data.ticketNumber,
    });
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('start-timer')
  async handleStartTimer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; duration: number },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId || !data?.duration) return;

    const isCreator = await this.estimatesService.isSessionCreator(
      data.sessionId,
      userId,
    );
    if (!isCreator) return;

    const timerEndsAt = await this.estimatesService.startTimer(
      data.sessionId,
      userId,
      data.duration,
    );
    this.server
      .to(`session:${data.sessionId}`)
      .emit('timer-started', { duration: data.duration, timerEndsAt });
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('end-session')
  async handleEndSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    const isCreator = await this.estimatesService.isSessionCreator(
      data.sessionId,
      userId,
    );
    if (!isCreator) return;

    await this.estimatesService.endSession(data.sessionId, userId);
    this.server.to(`session:${data.sessionId}`).emit('session-ended');
    this.emitSessionChanged(data.sessionId);
  }

  emitSessionChanged(sessionId: string): void {
    this.server
      .to(`session:${sessionId}`)
      .emit('session-changed', { sessionId });
    void this.estimatesProjectionSyncService.syncSessionProjection(sessionId);
  }

  private extractToken(cookieHeader: string): string | null {
    const match = cookieHeader.match(
      /(?:^|;\s*)better-auth\.session_token=([^;]+)/,
    );
    return match ? decodeURIComponent(match[1]) : null;
  }
}
