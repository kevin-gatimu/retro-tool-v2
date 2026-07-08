import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));

const SUBSCRIPTION = {
  id: 'sub-1',
  userId: 'user-1',
  endpoint: 'https://push.example/endpoint',
  p256dh: 'p256dh-key',
  auth: 'auth-key',
};

function buildService(frontendUrl: string | undefined): PushService {
  const config: Record<string, string | undefined> = {
    VAPID_PUBLIC_KEY: 'public',
    VAPID_PRIVATE_KEY: 'private',
    VAPID_SUBJECT: 'mailto:test@example.com',
    FRONTEND_URL: frontendUrl,
  };

  // Minimal Drizzle-style query chain that resolves to a single subscription.
  const database = {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([SUBSCRIPTION]),
      }),
    }),
  };

  return new PushService(
    database as never,
    { get: (key: string) => config[key] } as ConfigService,
  );
}

describe('PushService deep-link resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function sentPayload(): { url?: string } {
    const mock = webpush.sendNotification as jest.Mock<
      Promise<unknown>,
      [unknown, string, unknown]
    >;
    const body = mock.mock.calls[0][1];
    return JSON.parse(body) as { url?: string };
  }

  it('joins a relative link onto FRONTEND_URL', async () => {
    const service = buildService('https://staging.example.com');

    await service.sendPush('user-1', {
      title: 'Estimate',
      body: 'Join now',
      url: '/estimate/123',
    });

    expect(sentPayload().url).toBe('https://staging.example.com/estimate/123');
  });

  it('strips a trailing slash on FRONTEND_URL before joining', async () => {
    const service = buildService('https://staging.example.com/');

    await service.sendPush('user-1', {
      title: 'Estimate',
      body: 'Join now',
      url: '/estimate/123',
    });

    expect(sentPayload().url).toBe('https://staging.example.com/estimate/123');
  });

  it('passes an already-absolute link through unchanged', async () => {
    const service = buildService('https://staging.example.com');

    await service.sendPush('user-1', {
      title: 'Estimate',
      body: 'Join now',
      url: 'https://other.example.com/estimate/123',
    });

    expect(sentPayload().url).toBe('https://other.example.com/estimate/123');
  });

  it('leaves the link relative when FRONTEND_URL is unset', async () => {
    const service = buildService(undefined);

    await service.sendPush('user-1', {
      title: 'Estimate',
      body: 'Join now',
      url: '/estimate/123',
    });

    expect(sentPayload().url).toBe('/estimate/123');
  });
});
