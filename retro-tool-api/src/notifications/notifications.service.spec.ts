import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NotificationsGateway } from './notifications.gateway';
import { CacheService } from '../cache/cache.service';
import { PushService } from './push.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: DATABASE_CONNECTION, useValue: {} },
        { provide: NotificationsGateway, useValue: { emitToUser: jest.fn() } },
        { provide: PushService, useValue: { sendPush: jest.fn() } },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delPattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
