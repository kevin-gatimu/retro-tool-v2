import { Test, TestingModule } from '@nestjs/testing';
import { EstimatesGateway } from './estimates.gateway';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { EstimatesService } from './estimates.service';
import { CacheService } from '../cache/cache.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';

describe('EstimatesGateway', () => {
  let gateway: EstimatesGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimatesGateway,
        { provide: DATABASE_CONNECTION, useValue: {} },
        { provide: EstimatesService, useValue: {} },
        { provide: EstimatesProjectionSyncService, useValue: {} },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    gateway = module.get<EstimatesGateway>(EstimatesGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
