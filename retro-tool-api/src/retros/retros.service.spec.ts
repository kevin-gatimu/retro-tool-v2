import { Test, TestingModule } from '@nestjs/testing';
import { RetrosService } from './retros.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../cache/cache.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

describe('RetrosService', () => {
  let service: RetrosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrosService,
        { provide: DATABASE_CONNECTION, useValue: {} },
        {
          provide: NotificationsService,
          useValue: {
            createNotification: jest.fn(),
            sendNotifications: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RetrosService>(RetrosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
