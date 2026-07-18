import { Test, TestingModule } from '@nestjs/testing';
import type { Server, Socket } from 'socket.io';
import { EstimatesGateway } from './estimates.gateway';
import { EstimatesService } from './estimates.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';
import { WsAuthService } from '../auth/ws-auth';

describe('EstimatesGateway', () => {
  let gateway: EstimatesGateway;
  let estimatesService: {
    isSessionMember: jest.Mock;
    upsertParticipant: jest.Mock;
    getParticipant: jest.Mock;
  };
  let projectionSync: { enqueueSessionSync: jest.Mock };
  let emit: jest.Mock;

  const makeClient = (userId?: string): Socket => {
    const rooms = new Set<string>();
    return {
      data: { userId },
      join: jest.fn((room: string) => {
        rooms.add(room);
        return Promise.resolve();
      }),
      leave: jest.fn((room: string) => {
        rooms.delete(room);
        return Promise.resolve();
      }),
      // Test double: the gateway only touches data/join/leave on the socket;
      // the full Socket interface is too large to stub and irrelevant here.
    } as unknown as Socket;
  };

  beforeEach(async () => {
    estimatesService = {
      isSessionMember: jest.fn().mockResolvedValue(true),
      upsertParticipant: jest.fn().mockResolvedValue(undefined),
      getParticipant: jest.fn().mockResolvedValue({ userId: 'u1' }),
    };
    projectionSync = {
      enqueueSessionSync: jest.fn().mockResolvedValue(undefined),
    };
    emit = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimatesGateway,
        { provide: EstimatesService, useValue: estimatesService },
        { provide: EstimatesProjectionSyncService, useValue: projectionSync },
        { provide: WsAuthService, useValue: {} },
      ],
    }).compile();

    gateway = module.get<EstimatesGateway>(EstimatesGateway);
    // Minimal Socket.IO server stub: `server.to(room).emit(event, payload)`.
    // The full Server interface is too large to stub and unused beyond to()/emit().
    gateway.server = {
      to: jest.fn(() => ({ emit })),
      emit,
    } as unknown as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('clears presence for joined sessions on disconnect', async () => {
    const client = makeClient('u1');
    await gateway.handleJoinSession(client, { sessionId: 's1' });

    estimatesService.upsertParticipant.mockClear();

    await gateway.handleDisconnect(client);

    // Disconnect must mark the participant offline for the joined session.
    expect(estimatesService.upsertParticipant).toHaveBeenCalledWith(
      's1',
      'u1',
      false,
    );
    expect(emit).toHaveBeenCalledWith('participant-left', { userId: 'u1' });
    expect(projectionSync.enqueueSessionSync).toHaveBeenCalledWith('s1');
  });

  it('clears presence for every joined session on disconnect', async () => {
    const client = makeClient('u1');
    await gateway.handleJoinSession(client, { sessionId: 's1' });
    await gateway.handleJoinSession(client, { sessionId: 's2' });

    estimatesService.upsertParticipant.mockClear();

    await gateway.handleDisconnect(client);

    expect(estimatesService.upsertParticipant).toHaveBeenCalledWith(
      's1',
      'u1',
      false,
    );
    expect(estimatesService.upsertParticipant).toHaveBeenCalledWith(
      's2',
      'u1',
      false,
    );
    expect(estimatesService.upsertParticipant).toHaveBeenCalledTimes(2);
  });

  it('does not re-clear presence for a session already left explicitly', async () => {
    const client = makeClient('u1');
    await gateway.handleJoinSession(client, { sessionId: 's1' });
    await gateway.handleLeaveSession(client, { sessionId: 's1' });

    estimatesService.upsertParticipant.mockClear();

    await gateway.handleDisconnect(client);

    expect(estimatesService.upsertParticipant).not.toHaveBeenCalled();
  });

  it('no-ops on disconnect when the socket never joined a session', async () => {
    const client = makeClient('u1');

    await gateway.handleDisconnect(client);

    expect(estimatesService.upsertParticipant).not.toHaveBeenCalled();
  });

  it('no-ops on disconnect for an unauthenticated socket', async () => {
    const client = makeClient(undefined);

    await gateway.handleDisconnect(client);

    expect(estimatesService.upsertParticipant).not.toHaveBeenCalled();
  });
});
