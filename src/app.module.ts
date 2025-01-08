import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { TelegramUpdate } from './modules/telegram/telegram.update';
import { TransactionService } from './modules/transaction/transaction.service';
import { WalletService } from './modules/wallet/wallet.service';
import { TransactionRepository } from './modules/transaction/transaction.repository';
import configuration from './config/configuration';
import { TRANSACTION_REPOSITORY } from './modules/transaction/constants/transaction.constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get('telegram.botToken'),
        options: {
          handlerTimeout: 60000,
          telegram: {
            timeout: 30000,
            apiRoot: 'https://api.telegram.org',
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    TelegramUpdate,
    TransactionService,
    WalletService,
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TransactionRepository,
    },
  ],
})
export class AppModule {}