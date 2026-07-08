import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit tracker keyed on the real client IP when running behind a reverse
 * proxy (Azure App Service). Express populates `req.ips` from X-Forwarded-For
 * once `trust proxy` is set (see main.ts); we prefer the first forwarded hop
 * and fall back to the socket address otherwise.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const ips = req.ips as string[] | undefined;
    const ip = req.ip as string | undefined;
    return Promise.resolve(ips && ips.length > 0 ? ips[0] : (ip ?? 'unknown'));
  }
}
