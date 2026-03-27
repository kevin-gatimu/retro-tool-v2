import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  /** Whether a live Redis connection is available */
  get isConnected(): boolean {
    return this.redis?.status === 'ready';
  }

  /**
   * Get a cached value, parsed from JSON.
   * Returns `null` on miss or if Redis is unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as unknown as T;
    } catch (err) {
      this.logger.warn(`Cache GET failed for key "${key}": ${err}`);
      return null;
    }
  }

  /**
   * Set a value in cache with a TTL (seconds).
   * Silently no-ops if Redis is unavailable.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Cache SET failed for key "${key}": ${err}`);
    }
  }

  /**
   * Delete one or more exact keys.
   */
  async del(...keys: string[]): Promise<void> {
    if (!this.redis || keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Cache DEL failed: ${err}`);
    }
  }

  /**
   * Delete all keys matching a glob pattern (e.g. `retro-tool:rbac:*:user:abc`).
   *
   * Uses SCAN to avoid blocking Redis on large key sets.
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`Cache DEL pattern "${pattern}" failed: ${err}`);
    }
  }
}
