import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { SystemConfigDTO } from '../../config/configuration';

@Injectable()
export class KeepaliveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KeepaliveService.name);
  private keepaliveInterval: NodeJS.Timeout | null = null;
  private readonly KEEPALIVE_INTERVAL = 840000; // 14 minutes (Render's free tier sleep time is 15 minutes)
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Wait a bit for the server to fully start
    setTimeout(async () => {
      await this.initializeHealthCheck();
    }, 5000); // Wait 5 seconds before first check
  }

  onModuleDestroy() {
    this.stopKeepalive();
    this.logger.log('Keepalive service stopped');
  }

  private async initializeHealthCheck() {
    let retries = 0;
    while (retries < this.MAX_RETRIES) {
      if (await this.checkHealth()) {
        this.startKeepalive();
        const isProduction = this.configService.get<boolean>(
          SystemConfigDTO.IS_PRODUCTION,
        );
        this.logger.log(
          `Keepalive service started successfully in ${isProduction ? 'production' : 'development'} mode`,
        );
        return;
      }
      retries++;
      if (retries < this.MAX_RETRIES) {
        this.logger.log(
          `Retrying health check in ${this.RETRY_DELAY / 1000} seconds... (Attempt ${retries + 1}/${this.MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY));
      }
    }
    this.logger.error(
      'Failed to initialize health check after maximum retries',
    );
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const isProduction = this.configService.get<boolean>(
        SystemConfigDTO.IS_PRODUCTION,
      );
      const port = this.configService.get('port');
      const renderUrl = this.configService.get(SystemConfigDTO.RENDER_URL);

      // In development, always use localhost
      // In production, try localhost first, then fallback to RENDER_URL
      const urls = isProduction
        ? [`http://localhost:${port}`, renderUrl]
        : [`http://localhost:${port}`];

      for (const baseUrl of urls) {
        if (!baseUrl) continue;

        const sanitizedBaseUrl = baseUrl.replace(/\/+$/, '');
        const healthUrl = `${sanitizedBaseUrl}/health`;

        this.logger.debug(`Checking health at URL: ${healthUrl}`);

        try {
          const response = await fetch(healthUrl);

          if (response.ok) {
            const data = await response.json();
            this.logger.debug('Health check successful:', data);
            return true;
          }

          this.logger.warn(
            `Health check failed with status: ${response.status} ${response.statusText}`,
          );
        } catch (error) {
          this.logger.warn(`Failed to connect to ${healthUrl}:`, error.message);
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Health check failed:', error.message);
      if (error.cause) {
        this.logger.error('Error cause:', error.cause);
      }
      return false;
    }
  }

  private startKeepalive() {
    if (this.keepaliveInterval) {
      return;
    }

    this.keepaliveInterval = setInterval(async () => {
      await this.checkHealth();
    }, this.KEEPALIVE_INTERVAL);

    this.logger.log(
      `Keepalive service will ping every ${this.KEEPALIVE_INTERVAL / 60000} minutes`,
    );
  }

  private stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }
}
