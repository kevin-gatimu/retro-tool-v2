import { Test, TestingModule } from '@nestjs/testing';
import { EstimatesGateway } from './estimates.gateway';
import { EstimatesService } from './estimates.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';
import { WsAuthService } from '../auth/ws-auth';

describe('EstimatesGateway', () => {
  let gateway: EstimatesGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimatesGateway,
        { provide: EstimatesService, useValue: {} },
        { provide: EstimatesProjectionSyncService, useValue: {} },
        { provide: WsAuthService, useValue: {} },
      ],
    }).compile();

    gateway = module.get<EstimatesGateway>(EstimatesGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
