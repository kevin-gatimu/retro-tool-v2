import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@AllowAnonymous()
@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'retro-tool-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLiveness() {
    return {
      status: 'alive',
      service: 'retro-tool-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  getReadiness() {
    return {
      status: 'ready',
      service: 'retro-tool-api',
      timestamp: new Date().toISOString(),
    };
  }
}
