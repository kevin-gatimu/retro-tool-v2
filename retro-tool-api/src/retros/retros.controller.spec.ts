import { Test, TestingModule } from '@nestjs/testing';
import { RetrosController } from './retros.controller';
import { RetrosService } from './retros.service';
import { RetrosTemplatesService } from './retros-templates.service';
import { RetrosProjectionSyncService } from './retros-projection-sync.service';

describe('RetrosController', () => {
  let controller: RetrosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetrosController],
      providers: [
        { provide: RetrosService, useValue: {} },
        { provide: RetrosTemplatesService, useValue: {} },
        { provide: RetrosProjectionSyncService, useValue: {} },
      ],
    }).compile();

    controller = module.get<RetrosController>(RetrosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
