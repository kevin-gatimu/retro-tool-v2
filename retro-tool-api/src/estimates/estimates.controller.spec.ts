import { Test, TestingModule } from '@nestjs/testing';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';
import { EstimatesReportService } from './estimates-report.service';
import { EstimatesGateway } from './estimates.gateway';

describe('EstimatesController', () => {
  let controller: EstimatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstimatesController],
      providers: [
        { provide: EstimatesService, useValue: {} },
        { provide: EstimatesReportService, useValue: {} },
        {
          provide: EstimatesGateway,
          useValue: { emitSessionChanged: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<EstimatesController>(EstimatesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
