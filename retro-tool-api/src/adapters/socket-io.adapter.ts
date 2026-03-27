import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Config } from '../config/configuration';

export class SocketIoAdapter extends IoAdapter {
  private readonly allowedOrigins: string[];
  private readonly redisUrl?: string;
  private readonly logger = new Logger(SocketIoAdapter.name);

  constructor(app: INestApplication) {
    super(app);
    const configService = app.get(ConfigService<Config>);
    this.allowedOrigins = configService.get('allowedOrigins', {
      infer: true,
    }) ?? ['http://localhost:3000', 'http://localhost:8000'];
    this.redisUrl = configService.get('redis.url', { infer: true });
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.allowedOrigins,
        credentials: true,
      },
    }) as Server;

    if (this.redisUrl) {
      const pubClient = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          return Math.min(times * 200, 3000);
        },
        lazyConnect: false,
      });
      const subClient = pubClient.duplicate();
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Socket.IO Redis adapter enabled');
    } else {
      this.logger.warn('REDIS_URL not set — Socket.IO Redis adapter disabled');
    }

    return server;
  }
}
