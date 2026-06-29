import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import type { ClientData } from '../common/types';
import { WsAuthService } from '../auth/ws-auth';

@WebSocketGateway({
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly wsAuth: WsAuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    const userId = await this.wsAuth.authenticate(client);
    if (!userId) {
      client.disconnect();
      return;
    }

    (client.data as ClientData).userId = userId;
    await client.join(`user:${userId}`);
    this.logger.log(`Client connected: userId=${userId}`);
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
}
