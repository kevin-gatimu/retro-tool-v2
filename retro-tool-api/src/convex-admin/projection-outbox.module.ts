import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ConvexMutationClientService } from './convex-mutation-client.service';
import { ProjectionOutboxService } from './projection-outbox.service';

/**
 * Low-level module exposing the transactional projection outbox. Kept separate
 * from {@link ConvexAdminModule} (which imports every feature module) so the
 * feature projection-sync services can depend on the outbox — to enqueue
 * intents and register delivery handlers — without a dependency cycle.
 */
@Module({
  imports: [DatabaseModule],
  providers: [ConvexMutationClientService, ProjectionOutboxService],
  exports: [ConvexMutationClientService, ProjectionOutboxService],
})
export class ProjectionOutboxModule {}
