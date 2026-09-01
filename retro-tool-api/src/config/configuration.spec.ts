import configuration from './configuration';

const SESSION_ENV_KEYS = [
  'BETTER_AUTH_SESSION_EXPIRES_IN',
  'BETTER_AUTH_SESSION_UPDATE_AGE',
] as const;

describe('authentication session configuration', () => {
  const originalValues = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of [
      ...SESSION_ENV_KEYS,
      'NODE_ENV',
      'DATABASE_URL',
      'BETTER_AUTH_SECRET',
      'FRONTEND_URL',
      'LOCAL_SERVER_URL',
      'DEPLOYED_SERVER_URL',
      'EMAIL_FROM',
    ]) {
      originalValues.set(key, process.env[key]);
    }

    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://localhost/retro_tool_test';
    process.env.BETTER_AUTH_SECRET = 'test-secret';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.LOCAL_SERVER_URL = 'http://localhost:8000';
    process.env.DEPLOYED_SERVER_URL = 'https://api.example.com';
    process.env.EMAIL_FROM = 'test@example.com';
  });

  beforeEach(() => {
    for (const key of SESSION_ENV_KEYS) delete process.env[key];
  });

  afterAll(() => {
    for (const [key, value] of originalValues) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults to a 30-minute rolling session with five-minute refreshes', () => {
    const config = configuration();

    expect(config.auth.sessionExpiresIn).toBe(30 * 60);
    expect(config.auth.sessionUpdateAge).toBe(5 * 60);
  });

  it('accepts explicit server session timing', () => {
    process.env.BETTER_AUTH_SESSION_EXPIRES_IN = '3600';
    process.env.BETTER_AUTH_SESSION_UPDATE_AGE = '600';

    const config = configuration();

    expect(config.auth.sessionExpiresIn).toBe(3600);
    expect(config.auth.sessionUpdateAge).toBe(600);
  });

  it('rejects a refresh interval that cannot renew before expiration', () => {
    process.env.BETTER_AUTH_SESSION_EXPIRES_IN = '300';
    process.env.BETTER_AUTH_SESSION_UPDATE_AGE = '300';

    expect(() => configuration()).toThrow(
      'Session update age must be shorter than session expiration',
    );
  });
});
