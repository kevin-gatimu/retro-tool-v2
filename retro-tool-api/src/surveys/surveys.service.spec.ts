import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysQueryService } from './surveys-query.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import {
  SURVEY_QUESTION_TYPES,
  SURVEY_SCOPES,
  USER_ROLES,
} from '../common/enums';
import type { SurveyUserContext } from './types';
import type { CreateSurveyDto } from './dtos';

describe('SurveysService', () => {
  let service: SurveysService;
  let getUserContext: jest.Mock;
  const insertValues = jest.fn().mockResolvedValue(undefined);

  // Base membership footprint; individual tests tweak team/lead membership.
  const baseContext = (): SurveyUserContext => ({
    role: USER_ROLES.Member,
    teamIds: [],
    leadTeamIds: [],
    orgIds: [],
    orgAdminIds: [],
    orgIdByTeamId: {},
  });

  const teamSurveyDto = (teamId: string): CreateSurveyDto => ({
    title: 'Team Health',
    description: undefined,
    scope: SURVEY_SCOPES.Team,
    teamId,
    organizationId: undefined,
    isAnonymous: true,
    questions: [
      {
        type: SURVEY_QUESTION_TYPES.Text,
        prompt: 'How are things?',
        options: [],
        isRequired: true,
      },
    ],
  });

  beforeEach(async () => {
    getUserContext = jest.fn();
    insertValues.mockClear();

    const database = {
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveysService,
        { provide: DATABASE_CONNECTION, useValue: database },
        {
          provide: SurveysQueryService,
          useValue: { getUserContext },
        },
      ],
    }).compile();

    service = module.get<SurveysService>(SurveysService);
  });

  describe('createSurvey (team scope)', () => {
    it('lets a plain team member create a team-scoped survey', async () => {
      getUserContext.mockResolvedValue({
        ...baseContext(),
        teamIds: ['team-1'],
        leadTeamIds: [], // not a lead — just a member
      });

      const result = await service.createSurvey(
        'member-user',
        teamSurveyDto('team-1'),
      );
      expect(typeof result.id).toBe('string');
      // survey row + questions rows inserted
      expect(insertValues).toHaveBeenCalledTimes(2);
    });

    it('rejects a non-member creating a team-scoped survey', async () => {
      getUserContext.mockResolvedValue({
        ...baseContext(),
        teamIds: ['some-other-team'],
      });

      await expect(
        service.createSurvey('outsider', teamSurveyDto('team-1')),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(insertValues).not.toHaveBeenCalled();
    });
  });
});
