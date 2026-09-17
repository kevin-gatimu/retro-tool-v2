import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Config } from '../config/configuration';
import type { ConvexMutationResponse } from './types';

const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class ConvexMutationClientService {
  constructor(private readonly configService: ConfigService<Config, true>) {}

  isConfigured(): boolean {
    const convex = this.configService.get('convex', { infer: true });
    return Boolean(convex?.url && convex.adminKey);
  }

  async runMutation(path: string, args: object): Promise<void> {
    await this.request(path, args);
  }

  async runMutationForResult<T>(path: string, args: object): Promise<T | null> {
    const result = await this.request(path, args);
    if (!result) {
      return null;
    }
    if (!('value' in result)) {
      throw new Error(
        `Convex mutation ${path} returned an unexpected response payload`,
      );
    }
    return result.value as T;
  }

  private async request(
    path: string,
    args: object,
  ): Promise<ConvexMutationResponse | null> {
    const convex = this.configService.get('convex', { infer: true });
    if (!convex?.url || !convex.adminKey) {
      return null;
    }

    const response = await fetch(
      `${convex.url.replace(/\/$/, '')}/api/mutation`,
      {
        method: 'POST',
        headers: {
          Authorization: `Convex ${convex.adminKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, args, format: 'json' }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Convex mutation ${path} failed with status ${response.status}`,
      );
    }

    const result: unknown = await response.json();
    if (typeof result !== 'object' || result === null) {
      throw new Error(
        `Convex mutation ${path} returned an unexpected response payload`,
      );
    }

    const parsed = result as ConvexMutationResponse;
    if (parsed.status !== 'success' && parsed.status !== 'error') {
      throw new Error(
        `Convex mutation ${path} returned an unexpected response payload`,
      );
    }
    if (parsed.status === 'error') {
      const message =
        typeof parsed.errorMessage === 'string'
          ? parsed.errorMessage
          : 'unknown error';
      throw new Error(`Convex mutation ${path} returned an error: ${message}`);
    }

    return parsed;
  }
}
