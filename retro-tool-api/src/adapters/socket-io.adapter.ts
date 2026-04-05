import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, ServerOptions } from 'socket.io';
import { Config } from '../config/configuration';

export class SocketIoAdapter extends IoAdapter {
  private readonly allowedOrigins: string[];
  private readonly logger = new Logger(SocketIoAdapter.name);

  constructor(app: INestApplication) {
    super(app);
    const configService = app.get(ConfigService<Config>);
    this.allowedOrigins = configService.get('allowedOrigins', {
      infer: true,
    }) ?? ['http://localhost:3000', 'http://localhost:8000'];
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.allowedOrigins,
        credentials: true,
      },
    }) as Server;

    this.logger.log('Socket.IO server created (Redis adapter disabled)');

    return server;
  }
}
