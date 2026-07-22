import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The application version, read once from package.json at startup.
 * release-please bumps package.json on every release, so this is the single
 * source of truth surfaced via Swagger and the health endpoints.
 */
export const APP_VERSION: string = (() => {
  try {
    const packageJson = JSON.parse(
      // __dirname is src/lib in dev (ts-node) and dist/lib when compiled;
      // package.json sits two levels up in both layouts.
      readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
    ) as { version?: string };
    return packageJson.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
})();
