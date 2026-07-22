import type { ConfigService } from '@nestjs/config';
import type { AuthService } from '@thallesp/nestjs-better-auth';
import { JwtAlignmentService } from './jwt-alignment.service';
import type { Auth } from './auth.config';
import type { Config } from '../config/configuration';

type AuthConfigShape = {
  url?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
};

/**
 * Build a ConfigService stub mirroring how auth.config.ts reads config:
 * `get('auth')` returns the nested object, `get('auth.jwtAudience')` the leaf,
 * `get('port')` the port.
 */
function makeConfig(
  authConfig: AuthConfigShape,
  port = 8000,
): ConfigService<Config> {
  const stub: Pick<ConfigService<Config>, 'get'> = {
    get: jest.fn((key: string) => {
      if (key === 'auth') return authConfig;
      if (key === 'auth.jwtAudience') return authConfig.jwtAudience ?? 'convex';
      if (key === 'port') return port;
      return undefined;
    }) as ConfigService<Config>['get'],
  };
  return stub as ConfigService<Config>;
}

function makeAuth(getJwks: jest.Mock): AuthService<Auth> {
  const stub: { api: { getJwks: jest.Mock } } = { api: { getJwks } };
  // Test double: the service only calls auth.api.getJwks(); the full
  // AuthService<Auth> surface is irrelevant here, so stub just that method.
  return stub as unknown as AuthService<Auth>;
}

describe('JwtAlignmentService', () => {
  const okAuthConfig: AuthConfigShape = {
    url: 'http://localhost:8000',
    jwtIssuer: 'http://localhost:8000',
    jwtAudience: 'convex',
  };

  it('reports ok when JWKS is reachable, non-empty and RS256', async () => {
    const getJwks = jest.fn().mockResolvedValue({
      keys: [{ alg: 'RS256', kid: 'key-1' }],
    });
    const service = new JwtAlignmentService(
      makeAuth(getJwks),
      makeConfig(okAuthConfig),
    );

    const result = await service.check();

    expect(result).toMatchObject({
      status: 'ok',
      issuer: 'http://localhost:8000',
      audience: 'convex',
      keyCount: 1,
    });
  });

  it('resolves the issuer default from the API origin when jwtIssuer is unset', async () => {
    const getJwks = jest.fn().mockResolvedValue({
      keys: [{ alg: 'RS256', kid: 'key-1' }],
    });
    const service = new JwtAlignmentService(
      makeAuth(getJwks),
      makeConfig({ jwtAudience: 'convex' }, 8000),
    );

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.issuer).toBe('http://localhost:8000');
  });

  it('reports misaligned when the issuer is not a valid absolute URL', async () => {
    const getJwks = jest.fn();
    const service = new JwtAlignmentService(
      makeAuth(getJwks),
      makeConfig({ jwtIssuer: 'not-a-url', jwtAudience: 'convex' }),
    );

    const result = await service.check();

    expect(result.status).toBe('misaligned');
    expect(result.detail).toContain('not a valid absolute URL');
    // Config problem detected before ever hitting the JWKS endpoint.
    expect(getJwks).not.toHaveBeenCalled();
  });

  it('reports misaligned when JWKS advertises an algorithm Convex cannot verify', async () => {
    const getJwks = jest.fn().mockResolvedValue({
      keys: [{ alg: 'EdDSA', kid: 'key-1' }],
    });
    const service = new JwtAlignmentService(
      makeAuth(getJwks),
      makeConfig(okAuthConfig),
    );

    const result = await service.check();

    expect(result.status).toBe('misaligned');
    expect(result.detail).toContain('EdDSA');
  });

  it('reports unreachable when the JWKS endpoint throws', async () => {
    const getJwks = jest.fn().mockRejectedValue(new Error('network down'));
    const service = new JwtAlignmentService(
      makeAuth(getJwks),
      makeConfig(okAuthConfig),
    );

    const result = await service.check();

    expect(result.status).toBe('unreachable');
    expect(result.detail).toContain('network down');
  });

  it('reports unreachable when JWKS returns no keys', async () => {
    const getJwks = jest.fn().mockResolvedValue({ keys: [] });
    const service = new JwtAlignmentService(
      makeAuth(getJwks),
      makeConfig(okAuthConfig),
    );

    const result = await service.check();

    expect(result.status).toBe('unreachable');
    expect(result.keyCount).toBe(0);
  });

  it('never throws even if the JWKS response has an unexpected shape', async () => {
    const getJwks = jest.fn().mockResolvedValue(null);
    const service = new JwtAlignmentService(
      makeAuth(getJwks),
      makeConfig(okAuthConfig),
    );

    const result = await service.check();

    expect(result.status).toBe('unreachable');
  });
});
