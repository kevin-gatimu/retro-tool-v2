import { Test, TestingModule } from '@nestjs/testing';
import { RetrosController } from './retros.controller';
import { RetrosService } from './retros.service';
import { RetrosGateway } from './retros.gateway';

describe('RetrosController', () => {
  let controller: RetrosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetrosController],
      providers: [
        { provide: RetrosService, useValue: {} },
        {
          provide: RetrosGateway,
          useValue: {
            emitRetroUpdated: jest.fn(),
            emitCardMoved: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RetrosController>(RetrosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
