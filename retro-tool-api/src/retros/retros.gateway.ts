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
import type { ClientData } from '../common/types';
import { type TRetroStatus } from '../common/enums';
import { RetrosService } from './retros.service';
import { RetrosProjectionSyncService } from './retros-projection-sync.service';
import { WsAuthService } from '../auth/ws-auth';

@WebSocketGateway({
  namespace: '/retros',
})
export class RetrosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RetrosGateway.name);

  constructor(
    private readonly retrosService: RetrosService,
    private readonly retrosProjectionSyncService: RetrosProjectionSyncService,
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

  @SubscribeMessage('join-retro')
  async handleJoinRetro(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { retroId: string },
  ): Promise<void> {
    const { userId } = client.data as ClientData;
    if (!userId || !data?.retroId) return;

    // Authorize per event: handshake auth proves identity, not membership. Without
    // this a non-member socket could join any retro by ID and receive its realtime
    // board/card updates (SECURITY-ASSESSMENT F2). The REST getRetro path checks
    // the same membership.
    const isMember = await this.retrosService.isRetroMember(
      data.retroId,
      userId,
    );
    if (!isMember) return;

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
    void this.retrosProjectionSyncService.enqueueRetroSync(retroId);
  }

  emitRetroStatusChanged(retroId: string, status: TRetroStatus): void {
    this.server
      .to(`retro:${retroId}`)
      .emit('retro-changed', { retroId, status });
    void this.retrosProjectionSyncService.enqueueRetroSync(retroId);
  }

  emitDiscussionCardChanged(retroId: string, cardId: string): void {
    this.server
      .to(`retro:${retroId}`)
      .emit('discussion-card-changed', { retroId, cardId });
    void this.retrosProjectionSyncService.enqueueRetroSync(retroId);
  }

  emitDiscussionActionItemChanged(retroId: string, actionItemId: string): void {
    this.server
      .to(`retro:${retroId}`)
      .emit('discussion-action-item-changed', { retroId, actionItemId });
    void this.retrosProjectionSyncService.enqueueRetroSync(retroId);
  }

  emitCarriedForwardChanged(retroId: string, actionItemId?: string): void {
    this.server
      .to(`retro:${retroId}`)
      .emit('carried-forward-changed', { retroId, actionItemId });
    void this.retrosProjectionSyncService.enqueueRetroSync(retroId);
  }

  emitRetroListChanged(): void {
    this.server.emit('retro-list-changed');
  }
}
