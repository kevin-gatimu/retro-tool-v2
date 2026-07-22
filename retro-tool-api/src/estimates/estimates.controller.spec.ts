import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';
import { EstimatesReportService } from './estimates-report.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';
import type { SessionUser } from '../common/types';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user_123';

const asSession = (): SessionUser => ({ user: { id: USER_ID } });

describe('EstimatesController', () => {
  let controller: EstimatesController;
  let service: {
    isSessionMember: jest.Mock;
    canManageSession: jest.Mock;
    canControlSession: jest.Mock;
    upsertParticipant: jest.Mock;
    upsertVote: jest.Mock;
    startRound: jest.Mock;
    endSession: jest.Mock;
  };
  let projectionSync: { enqueueSessionSync: jest.Mock };

  beforeEach(async () => {
    service = {
      isSessionMember: jest.fn(),
      canManageSession: jest.fn(),
      canControlSession: jest.fn(),
      upsertParticipant: jest.fn().mockResolvedValue(undefined),
      upsertVote: jest.fn().mockResolvedValue(undefined),
      startRound: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    projectionSync = {
      enqueueSessionSync: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstimatesController],
      providers: [
        { provide: EstimatesService, useValue: service },
        { provide: EstimatesReportService, useValue: {} },
        { provide: EstimatesProjectionSyncService, useValue: projectionSync },
      ],
    }).compile();

    controller = module.get<EstimatesController>(EstimatesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('member-gated endpoints', () => {
    it('rejects a non-member casting a vote and does not persist or sync', async () => {
      service.isSessionMember.mockResolvedValue(false);

      await expect(
        controller.castVoteRest(asSession(), SESSION_ID, { points: '5' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(service.upsertVote).not.toHaveBeenCalled();
      expect(projectionSync.enqueueSessionSync).not.toHaveBeenCalled();
    });

    it('lets a member cast a vote and triggers a projection sync', async () => {
      service.isSessionMember.mockResolvedValue(true);

      const result = await controller.castVoteRest(asSession(), SESSION_ID, {
        points: '5',
      });

      expect(service.upsertVote).toHaveBeenCalledWith(SESSION_ID, USER_ID, '5');
      expect(projectionSync.enqueueSessionSync).toHaveBeenCalledWith(
        SESSION_ID,
      );
      expect(result).toEqual({ success: true });
    });

    it('rejects a non-member toggling presence', async () => {
      service.isSessionMember.mockResolvedValue(false);

      await expect(
        controller.setParticipantPresence(asSession(), SESSION_ID, {
          online: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(service.upsertParticipant).not.toHaveBeenCalled();
      expect(projectionSync.enqueueSessionSync).not.toHaveBeenCalled();
    });

    it('lets a member toggle presence and triggers a projection sync', async () => {
      service.isSessionMember.mockResolvedValue(true);

      await controller.setParticipantPresence(asSession(), SESSION_ID, {
        online: false,
      });

      expect(service.upsertParticipant).toHaveBeenCalledWith(
        SESSION_ID,
        USER_ID,
        false,
      );
      expect(projectionSync.enqueueSessionSync).toHaveBeenCalledWith(
        SESSION_ID,
      );
    });
  });

  describe('control-only endpoints (creator or team lead)', () => {
    it('rejects a non-controller starting a round and does not persist or sync', async () => {
      service.canControlSession.mockResolvedValue(false);

      await expect(
        controller.startRoundRest(asSession(), SESSION_ID, {
          ticketNumber: 'SPR-1',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(service.startRound).not.toHaveBeenCalled();
      expect(projectionSync.enqueueSessionSync).not.toHaveBeenCalled();
    });

    it('lets a controller start a round and triggers a projection sync', async () => {
      service.canControlSession.mockResolvedValue(true);

      const result = await controller.startRoundRest(asSession(), SESSION_ID, {
        ticketNumber: 'SPR-1',
      });

      expect(service.startRound).toHaveBeenCalledWith(SESSION_ID, USER_ID, {
        ticketNumber: 'SPR-1',
      });
      expect(projectionSync.enqueueSessionSync).toHaveBeenCalledWith(
        SESSION_ID,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('manager-only endpoints (end session)', () => {
    it('rejects a non-manager ending the session', async () => {
      service.canManageSession.mockResolvedValue(false);

      await expect(
        controller.endSessionRest(asSession(), SESSION_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(service.endSession).not.toHaveBeenCalled();
      expect(projectionSync.enqueueSessionSync).not.toHaveBeenCalled();
    });

    it('lets a manager end the session and triggers a projection sync', async () => {
      service.canManageSession.mockResolvedValue(true);

      await controller.endSessionRest(asSession(), SESSION_ID);

      expect(service.endSession).toHaveBeenCalledWith(SESSION_ID, USER_ID);
      expect(projectionSync.enqueueSessionSync).toHaveBeenCalledWith(
        SESSION_ID,
      );
    });
  });
});
