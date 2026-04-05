import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NotificationsGateway } from './notifications.gateway';
import { PushService } from './push.service';
import { NotificationsProjectionSyncService } from './notifications-projection-sync.service';

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
          provide: NotificationsProjectionSyncService,
          useValue: {
            syncNotificationReadState: jest.fn(),
            syncAllNotificationsRead: jest.fn(),
            syncNotificationProjection: jest.fn(),
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
