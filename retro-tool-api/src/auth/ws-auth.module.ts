import { Module } from '@nestjs/common';
import { WsAuthService } from './ws-auth';

/**
 * Provides {@link WsAuthService} to the realtime gateways. Relies on the
 * globally-registered `AuthService` (BetterAuthModule is `isGlobal`), so it
 * needs no imports of its own.
 */
@Module({
  providers: [WsAuthService],
  exports: [WsAuthService],
})
export class WsAuthModule {}
