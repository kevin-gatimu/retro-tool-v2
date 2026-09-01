import { ConvexAdminService } from './convex-admin.service';

const timestamp = { secs_since_epoch: 1_700_000_000, nanos_since_epoch: 0 };
const series = [[timestamp, 4]];

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () =>
      Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

describe('ConvexAdminService operational metrics', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function createService(configured = true) {
    const configService = {
      get: jest
        .fn()
        .mockReturnValue(
          configured
            ? { url: 'https://convex.example.test/', adminKey: 'admin-key' }
            : { url: undefined, adminKey: undefined },
        ),
    };
    const commonService = {
      isSuperAdmin: jest.fn().mockResolvedValue(true),
    };

    return new ConvexAdminService(
      {} as never,
      configService as never,
      commonService as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('uses the self-hosted app metrics window contract and maps timeseries', async () => {
    const fetchMock = jest.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(requestUrl(input));
        void init;
        if (url.pathname === '/version') {
          return Promise.resolve(response('convex-test'));
        }
        if (url.pathname.endsWith('/function_concurrency')) {
          return Promise.resolve(
            response({
              'outstanding_functions:isolate:Query:running': series,
              'outstanding_functions:isolate:Mutation:queued': series,
            }),
          );
        }
        if (url.pathname.endsWith('/scheduled_job_lag')) {
          return Promise.resolve(response(series));
        }
        return Promise.resolve(response([['messages:list', series]]));
      },
    );
    global.fetch = fetchMock as typeof fetch;

    const result = await createService().getOperationalMetrics('user-1', 15);

    expect(result.status).toBe('available');
    expect(result.rangeMinutes).toBe(15);
    expect(result.functionCalls[0]).toMatchObject({
      name: 'messages:list',
      points: [{ value: 4 }],
    });
    expect(result.concurrency.running[0].name).toBe('Queries');
    expect(result.concurrency.queued[0].name).toBe('Mutations');
    expect(result.summaries.totalCalls).toBe(4);
    expect(result.summaries.averageCallsPerMinute).toBeCloseTo(4 / 15);
    expect(result.summaries.queuedBucketPercentage).toBe(100);
    expect(result.health.status).toBe('degraded');
    const capacityInsight = result.insights.find(
      (insight) => insight.category === 'capacity',
    );
    expect(capacityInsight).toBeDefined();
    expect(capacityInsight?.evidence).toContain('peak queued');
    expect(capacityInsight?.impact).toContain(
      'not a configured capacity limit',
    );
    expect(capacityInsight?.recommendation).toBeTruthy();

    const metricsCall = fetchMock.mock.calls.find(([input]) =>
      requestUrl(input).includes('function_call_count_top_k'),
    );
    expect(metricsCall).toBeDefined();
    const metricsUrl = new URL(requestUrl(metricsCall?.[0] ?? ''));
    const rawWindow = metricsUrl.searchParams.get('window') ?? '{}';
    const window = JSON.parse(rawWindow) as {
      num_buckets?: number;
      start?: { secs_since_epoch?: number };
    };
    expect(window.num_buckets).toBe(15);
    expect(window.start?.secs_since_epoch).toEqual(expect.any(Number));
    expect(metricsUrl.searchParams.get('k')).toBe('10');
    expect(metricsCall?.[1]).toMatchObject({
      headers: {
        Authorization: 'Convex admin-key',
        'Convex-Client': 'dashboard-0.0.0',
      },
    });
  });

  it('uses bounded daily buckets for the yearly window', async () => {
    const fetchMock = jest.fn((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.endsWith('/version')) {
        return Promise.resolve(response('convex-test'));
      }
      if (url.includes('function_concurrency')) {
        return Promise.resolve(response({}));
      }
      return Promise.resolve(response([]));
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await createService().getOperationalMetrics(
      'user-1',
      525_600,
    );

    expect(result.rangeMinutes).toBe(525_600);
    expect(result.bucketCount).toBe(365);
    expect(result.bucketMinutes).toBe(1440);

    const metricsCall = fetchMock.mock.calls.find(([input]) =>
      requestUrl(input).includes('function_call_count_top_k'),
    );
    const rawWindow =
      new URL(requestUrl(metricsCall?.[0] ?? '')).searchParams.get('window') ??
      '{}';
    const window = JSON.parse(rawWindow) as { num_buckets?: number };
    expect(window.num_buckets).toBe(365);
  });

  it('falls back to the one-hour window for unsupported ranges', async () => {
    global.fetch = jest.fn((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.endsWith('/version')) {
        return Promise.resolve(response('convex-test'));
      }
      if (url.includes('function_concurrency')) {
        return Promise.resolve(response({}));
      }
      return Promise.resolve(response([]));
    }) as typeof fetch;

    const result = await createService().getOperationalMetrics('user-1', 999);

    expect(result.rangeMinutes).toBe(60);
    expect(result.bucketCount).toBe(60);
    expect(result.bucketMinutes).toBe(1);
  });

  it('reports partial data when an individual metric request fails', async () => {
    global.fetch = jest.fn((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.endsWith('/version')) {
        return Promise.resolve(response('convex-test'));
      }
      if (url.includes('failure_percentage_top_k')) {
        return Promise.resolve(response('metric unavailable', 503));
      }
      if (url.includes('function_concurrency')) {
        return Promise.resolve(response({}));
      }
      if (url.includes('scheduled_job_lag')) {
        return Promise.resolve(response(series));
      }
      return Promise.resolve(response([]));
    }) as typeof fetch;

    const result = await createService().getOperationalMetrics('user-1');

    expect(result.status).toBe('partial');
    expect(result.errors).toEqual([
      expect.objectContaining({ metric: 'failurePercentages' }),
    ]);
    expect(result.scheduledJobLag).toHaveLength(1);
  });

  it('returns an unavailable health response when Convex is not configured', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await createService(false).getOperationalMetrics('user-1');

    expect(result.status).toBe('unavailable');
    expect(result.health.status).toBe('unavailable');
    expect(result.errors[0].metric).toBe('configuration');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
