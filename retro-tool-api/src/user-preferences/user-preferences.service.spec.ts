import { Test, TestingModule } from '@nestjs/testing';
import { UserPreferencesService } from './user-preferences.service';
import { DATABASE_CONNECTION } from '../database/database-connection';

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPreferencesService,
        { provide: DATABASE_CONNECTION, useValue: {} },
      ],
    }).compile();

    service = module.get<UserPreferencesService>(UserPreferencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
