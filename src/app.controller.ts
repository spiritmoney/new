import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  healthCheck() {
    this.logger.debug('Health check endpoint called');
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    this.logger.debug('Health check response:', response);
    return response;
  }
}
