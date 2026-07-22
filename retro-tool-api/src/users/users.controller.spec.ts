import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersQueryService } from './users-query.service';
import { UsersAdminService } from './users-admin.service';
import { CommonService } from '../common/common.service';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getUsers: jest.fn(),
            updateUser: jest.fn(),
            getUser: jest.fn(),
          },
        },
        {
          provide: UsersQueryService,
          useValue: {},
        },
        {
          provide: UsersAdminService,
          useValue: {},
        },
        {
          provide: CommonService,
          useValue: {
            getUserFromBetterAuth: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
