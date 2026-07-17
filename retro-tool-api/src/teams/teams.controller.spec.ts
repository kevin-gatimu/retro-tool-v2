import { Test, TestingModule } from '@nestjs/testing';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamsQueryService } from './teams-query.service';
import { TeamsMembersService } from './teams-members.service';
import { TeamsJoinRequestsService } from './teams-join-requests.service';

describe('TeamsController', () => {
  let controller: TeamsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        {
          provide: TeamsService,
          useValue: {},
        },
        {
          provide: TeamsQueryService,
          useValue: {},
        },
        {
          provide: TeamsMembersService,
          useValue: {},
        },
        {
          provide: TeamsJoinRequestsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<TeamsController>(TeamsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
