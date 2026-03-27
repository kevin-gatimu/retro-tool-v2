import { Test, TestingModule } from '@nestjs/testing';
import { WeeklyDigestsService } from './weekly-digests.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { EmailService } from '../email/email.service';
import { ReportsService } from '../reports/reports.service';
import { ConfigService } from '@nestjs/config';

describe('WeeklyDigestsService', () => {
  let service: WeeklyDigestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeeklyDigestsService,
        { provide: DATABASE_CONNECTION, useValue: {} },
        {
          provide: EmailService,
          useValue: {
            send: jest.fn(),
            buildWeeklyDigestHtml: jest.fn(() => '<p>html</p>'),
          },
        },
        {
          provide: ReportsService,
          useValue: { getTeamMetrics: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn(() => true) } },
      ],
    }).compile();

    service = module.get<WeeklyDigestsService>(WeeklyDigestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
