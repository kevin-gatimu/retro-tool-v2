import { Test, TestingModule } from '@nestjs/testing';
import { CacheService, REDIS_CLIENT } from './cache.service';

interface MockRedis {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  scan: jest.Mock;
  status: string;
}

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: MockRedis;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      status: 'ready',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService, { provide: REDIS_CLIENT, useValue: mockRedis }],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return parsed JSON on cache hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: '1' }));
      const result = await service.get('key');
      expect(result).toEqual({ id: '1' });
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.get('key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      await service.set('key', { id: '1' }, 60);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ id: '1' }),
        'EX',
        60,
      );
    });
  });

  describe('del', () => {
    it('should delete keys', async () => {
      mockRedis.del.mockResolvedValue(1);
      await service.del('key1', 'key2');
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
    });
  });

  describe('graceful degradation (no Redis)', () => {
    let noRedisService: CacheService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [CacheService, { provide: REDIS_CLIENT, useValue: null }],
      }).compile();
      noRedisService = module.get<CacheService>(CacheService);
    });

    it('get returns null', async () => {
      expect(await noRedisService.get('key')).toBeNull();
    });

    it('set is a no-op', async () => {
      await expect(
        noRedisService.set('key', 'val', 60),
      ).resolves.toBeUndefined();
    });

    it('del is a no-op', async () => {
      await expect(noRedisService.del('key')).resolves.toBeUndefined();
    });

    it('delPattern is a no-op', async () => {
      await expect(noRedisService.delPattern('*')).resolves.toBeUndefined();
    });
  });
});
