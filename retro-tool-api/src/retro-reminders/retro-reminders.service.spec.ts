import { Test, TestingModule } from '@nestjs/testing';
import { RetroRemindersService } from './retro-reminders.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

describe('RetroRemindersService', () => {
  let service: RetroRemindersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetroRemindersService,
        { provide: DATABASE_CONNECTION, useValue: {} },
        {
          provide: EmailService,
          useValue: {
            send: jest.fn(),
            buildRetroReminderHtml: jest.fn(() => '<p>html</p>'),
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn(() => true) } },
      ],
    }).compile();

    service = module.get<RetroRemindersService>(RetroRemindersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
