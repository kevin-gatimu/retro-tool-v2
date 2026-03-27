import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { CommonService } from '../common/common.service';
import { CacheService } from '../cache/cache.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DATABASE_CONNECTION, useValue: {} },
        {
          provide: CommonService,
          useValue: {
            getUserFromBetterAuth: jest.fn(),
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

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
