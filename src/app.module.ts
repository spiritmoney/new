import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { TelegramUpdate } from './modules/telegram/telegram.update';
import { TransactionService } from './modules/transaction/transaction.service';
import { WalletService } from './modules/wallet/wallet.service';
import { RatesService } from './modules/rates/rates.service';
import { BankService } from './modules/bank/bank.service';
import { PaystackService } from './modules/paystack/paystack.service';
import { TransactionRepository } from './modules/transaction/transaction.repository';
import configuration from './config/configuration';
import { TRANSACTION_REPOSITORY } from './modules/transaction/constants/transaction.constants';
import { session } from 'telegraf';

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
        middlewares: [
          session({
            defaultSession: () => ({
              __scenes: {},
              state: {},
            }),
          }),
        ],
        options: {
          handlerTimeout: 60000,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    TelegramUpdate,
    TransactionService,
    WalletService,
    RatesService,
    BankService,
    PaystackService,
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TransactionRepository,
    },
  ],
})
export class AppModule {}
