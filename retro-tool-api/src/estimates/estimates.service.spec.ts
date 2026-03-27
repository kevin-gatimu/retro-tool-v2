import { Test, TestingModule } from '@nestjs/testing';
import { EstimatesService } from './estimates.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../cache/cache.service';

describe('EstimatesService', () => {
  let service: EstimatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimatesService,
        { provide: DATABASE_CONNECTION, useValue: {} },
        {
          provide: NotificationsService,
          useValue: { notifyTeamOfEstimateSession: jest.fn() },
        },
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

    service = module.get<EstimatesService>(EstimatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
