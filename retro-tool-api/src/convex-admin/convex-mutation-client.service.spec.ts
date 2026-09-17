import type { ConfigService } from '@nestjs/config';
import type { Config } from '../config/configuration';
import { ConvexMutationClientService } from './convex-mutation-client.service';

describe('ConvexMutationClientService', () => {
  const build = (configured = true) => {
    const configService = {
      get: jest
        .fn()
        .mockReturnValue(
          configured
            ? { url: 'https://convex.example/', adminKey: 'secret' }
            : { url: undefined, adminKey: undefined },
        ),
    } as unknown as ConfigService<Config, true>;
    return new ConvexMutationClientService(configService);
  };

  afterEach(() => jest.restoreAllMocks());

  it('no-ops when Convex is not configured', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      build(false).runMutation('test:run', {}),
    ).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns successful mutation values', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: 'success', value: { done: true } }),
          { status: 200 },
        ),
      );

    await expect(
      build().runMutationForResult<{ done: boolean }>('test:run', { id: '1' }),
    ).resolves.toEqual({ done: true });
  });

  it('throws on Convex function errors', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: 'error', errorMessage: 'timed out' }),
          { status: 200 },
        ),
      );

    await expect(build().runMutation('test:run', {})).rejects.toThrow(
      'Convex mutation test:run returned an error: timed out',
    );
  });

  it('throws on malformed successful responses', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'success' }), { status: 200 }),
      );

    await expect(
      build().runMutationForResult<{ done: boolean }>('test:run', {}),
    ).rejects.toThrow('unexpected response payload');
  });
});
