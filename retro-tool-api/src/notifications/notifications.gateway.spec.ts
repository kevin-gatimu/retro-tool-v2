import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from './notifications.gateway';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { CacheService } from '../cache/cache.service';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: DATABASE_CONNECTION, useValue: {} },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
