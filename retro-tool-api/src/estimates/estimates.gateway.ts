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
import { Logger } from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';
import { NewEstimateRoundDto, UpdateEstimateStoryDto } from './dtos';
import type { ClientData } from '../common/types';
import { WsAuthService } from '../auth/ws-auth';

@WebSocketGateway({
  namespace: '/estimates',
})
export class EstimatesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EstimatesGateway.name);

  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly estimatesProjectionSyncService: EstimatesProjectionSyncService,
    private readonly wsAuth: WsAuthService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const userId = await this.wsAuth.authenticate(client);
    if (!userId) {
      client.disconnect();
      return;
    }

    (client.data as ClientData).userId = userId;
    this.logger.log(`Client connected: userId=${userId}`);
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

    const canManage: boolean = await this.estimatesService.canManageSession(
      data.sessionId,
      userId,
    );
    if (!canManage) return;

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

    const canManage = await this.estimatesService.canManageSession(
      data.sessionId,
      userId,
    );
    if (!canManage) return;

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

    const canManage = await this.estimatesService.canManageSession(
      data.sessionId,
      userId,
    );
    if (!canManage) return;

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

    const canManage = await this.estimatesService.canManageSession(
      data.sessionId,
      userId,
    );
    if (!canManage) return;

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

    const canManage = await this.estimatesService.canManageSession(
      data.sessionId,
      userId,
    );
    if (!canManage) return;

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

    const canManage = await this.estimatesService.canManageSession(
      data.sessionId,
      userId,
    );
    if (!canManage) return;

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
}
