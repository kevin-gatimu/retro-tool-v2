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
import { StandupsProjectionSyncService } from './standups-projection-sync.service';
import { WsAuthService } from '../auth/ws-auth';

@WebSocketGateway({
  namespace: '/standups',
})
export class StandupsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(StandupsGateway.name);

  constructor(
    private readonly standupsProjectionSyncService: StandupsProjectionSyncService,
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

  @SubscribeMessage('join-standup')
  async handleJoinStandup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { standupId: string },
  ): Promise<void> {
    if (!data?.standupId) return;
    await client.join(`standup:${data.standupId}`);
  }

  @SubscribeMessage('leave-standup')
  async handleLeaveStandup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { standupId: string },
  ): Promise<void> {
    if (!data?.standupId) return;
    await client.leave(`standup:${data.standupId}`);
  }

  emitEntryChanged(standupId: string, date: string): void {
    this.server
      .to(`standup:${standupId}`)
      .emit('standup-entry-changed', { standupId, date });
    void this.standupsProjectionSyncService.syncEntryProjection(
      standupId,
      date,
    );
  }

  emitStandupChanged(standupId: string): void {
    this.server
      .to(`standup:${standupId}`)
      .emit('standup-changed', { standupId });
  }

  emitStandupListChanged(): void {
    this.server.emit('standup-list-changed');
  }
}
