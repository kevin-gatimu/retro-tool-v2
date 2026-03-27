import { Controller, Get } from '@nestjs/common';

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
