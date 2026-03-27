import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService, REDIS_CLIENT } from './cache.service';
import { Config } from '../config/configuration';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService<Config, true>): Redis | null => {
        const logger = new Logger('CacheModule');
        const url = config.get('redis.url', { infer: true });

        if (!url) {
          logger.warn(
            'REDIS_URL not set — caching disabled (all queries hit DB directly)',
          );
          return null;
        }

        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          retryStrategy(times) {
            // Exponential back-off capped at 3 seconds
            return Math.min(times * 200, 3000);
          },
          lazyConnect: false,
        });

        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err) =>
          logger.error(`Redis error: ${err.message}`),
        );
        client.on('close', () => logger.warn('Redis connection closed'));

        return client;
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
