/**
 * Standalone CLI to rebuild every Convex projection from PostgreSQL and prune
 * stale rows. Runs the same {@link ProjectionReconciliationService} the
 * super-admin HTTP endpoint uses, but from a headless Nest application context
 * so it can run in CI / a deploy step without an authenticated request.
 *
 * Requires DATABASE_URL, CONVEX_SYNC_URL and CONVEX_SYNC_ADMIN_KEY in the
 * environment (the deploy workflow supplies these). Exits non-zero if any
 * projection failed, so a release gate can stop on a partial reconciliation.
 *
 * Run against a built image:  node dist/convex-admin/reconcile-projections.js
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { ProjectionReconciliationService } from './projection-reconciliation.service';

async function main(): Promise<void> {
  const logger = new Logger('reconcile-projections');

  // Headless context — no HTTP server, no scheduler timers needed.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const reconciliation = app.get(ProjectionReconciliationService, {
      strict: false,
    });
    const report = await reconciliation.reconcileAll();

    logger.log(
      `Reconciliation ${report.runId} finished in ${report.durationMs}ms — ok=${report.ok}`,
    );
    for (const projection of report.reports) {
      logger.log(
        `  ${projection.projection}: scanned=${projection.scanned} deletedStale=${projection.deletedStale} failed=${projection.failed}` +
          (projection.error ? ` error=${projection.error}` : ''),
      );
    }

    // Emit machine-readable JSON on stdout for the deploy workflow to capture.
    process.stdout.write(`${JSON.stringify(report)}\n`);

    if (!report.ok) {
      logger.error('Reconciliation reported failures — exiting non-zero');
      await app.close();
      process.exit(1);
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';

  console.error('Reconciliation failed:', message);
  process.exit(1);
});
