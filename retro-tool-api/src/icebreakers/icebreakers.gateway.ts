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
import { IcebreakersService } from './icebreakers.service';
import { IcebreakersProjectionSyncService } from './icebreakers-projection-sync.service';
import type { ClientData } from '../common/types';
import { WsAuthService } from '../auth/ws-auth';
import {
  ICEBREAKER_PROMPT_DECISIONS,
  type TIcebreakerPromptDecision,
} from '../common/enums';

@WebSocketGateway({
  namespace: '/icebreakers',
})
export class IcebreakersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(IcebreakersGateway.name);

  constructor(
    private readonly icebreakersService: IcebreakersService,
    private readonly icebreakersProjectionSyncService: IcebreakersProjectionSyncService,
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

  // ==========================================================================
  // WebSocket Event Handlers
  // ==========================================================================

  @SubscribeMessage('join-session')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    // Authorize per event: handshake auth proves identity, not membership. Without
    // this a non-member socket could join any session by ID (SECURITY-ASSESSMENT F2).
    const isMember = await this.icebreakersService.isSessionMember(
      data.sessionId,
      userId,
    );
    if (!isMember) return;

    await this.icebreakersService.upsertParticipant(
      data.sessionId,
      userId,
      true,
    );
    await client.join(`session:${data.sessionId}`);

    const participant = await this.icebreakersService.getParticipant(
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

    await this.icebreakersService.upsertParticipant(
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

  @SubscribeMessage('swipe-prompt')
  async handleSwipePrompt(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { sessionId: string; decision: string; sessionPromptId: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId || !data?.sessionPromptId) return;

    const decision = this.normalizeDecision(data.decision);
    if (!decision) return;

    const canManage = await this.icebreakersService.canManageSession(
      data.sessionId,
      userId,
    );
    if (!canManage) return;

    await this.icebreakersService.swipePrompt(
      data.sessionId,
      userId,
      decision,
      data.sessionPromptId,
    );
    this.server
      .to(`session:${data.sessionId}`)
      .emit('prompt-swiped', { decision });
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('advance-prompt')
  async handleAdvancePrompt(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    const canManage = await this.icebreakersService.canManageSession(
      data.sessionId,
      userId,
    );
    if (!canManage) return;

    await this.icebreakersService.advancePrompt(data.sessionId, userId);
    this.server.to(`session:${data.sessionId}`).emit('prompt-advanced');
    this.emitSessionChanged(data.sessionId);
  }

  @SubscribeMessage('end-session')
  async handleEndSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.sessionId) return;

    const canManage = await this.icebreakersService.canManageSession(
      data.sessionId,
      userId,
    );
    if (!canManage) return;

    await this.icebreakersService.endSession(data.sessionId, userId);
    this.server.to(`session:${data.sessionId}`).emit('session-ended');
    this.emitSessionChanged(data.sessionId);
  }

  emitSessionChanged(sessionId: string): void {
    this.server
      .to(`session:${sessionId}`)
      .emit('session-changed', { sessionId });
    void this.icebreakersProjectionSyncService.enqueueSessionSync(sessionId);
  }

  private normalizeDecision(value: string): TIcebreakerPromptDecision | null {
    if (value === ICEBREAKER_PROMPT_DECISIONS.Kept) {
      return ICEBREAKER_PROMPT_DECISIONS.Kept;
    }
    if (value === ICEBREAKER_PROMPT_DECISIONS.Skipped) {
      return ICEBREAKER_PROMPT_DECISIONS.Skipped;
    }
    return null;
  }
}
