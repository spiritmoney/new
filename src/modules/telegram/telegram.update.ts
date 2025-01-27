import { Update, Ctx, Start, Command, Action, On } from 'nestjs-telegraf';
import { Context } from './interfaces/context.interface';
import { Markup } from 'telegraf';
import { TransactionService } from '../transaction/transaction.service';
import {
  TransactionStatus,
  CryptoCurrency,
} from '../transaction/interfaces/transaction.interface';
import { BankDetailsDto } from '../transaction/dto/bank-details.dto';
import { Logger, Inject } from '@nestjs/common';
import { RatesService } from '../rates/rates.service';
import { BankService } from '../bank/bank.service';
import * as moment from 'moment';
import { PaystackService } from '../paystack/paystack.service';
import { TransactionRepository } from '../transaction/transaction.repository';
import { TRANSACTION_REPOSITORY } from '../transaction/constants/transaction.constants';
import { ITransactionRepository } from '../transaction/interfaces/transaction-repository.interface';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  private readonly EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds
  private countdownIntervals: Map<number, NodeJS.Timeout> = new Map(); // Track intervals by chat ID

  constructor(
    private readonly transactionService: TransactionService,
    private readonly ratesService: RatesService,
    private readonly bankService: BankService,
    private readonly paystackService: PaystackService,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {
    this.logger.log('TelegramUpdate initialized');
  }

  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply(
      'Welcome to HopprX Bot!\n\n' +
        'What can this bot do?\n' +
        '- Instantly buy and sell crypto for fiat, incognito.\n' +
        '- Zero data collection.\n\n' +
        'Current max tradable amount per trade - $2000\n\n' +
        'Use these commands:',
      Markup.keyboard([
        ['💰 Buy', '💱 Sell'],
        ['📊 Rates', '📈 Status'],
        ['❌ Cancel'],
      ]).resize(),
    );
  }

  @Command('sell')
  async sell(@Ctx() ctx: Context) {
    if (!ctx.session) {
      ctx.session = {
        __scenes: {},
        state: {},
      };
    } else if (!ctx.session.state) {
      ctx.session.state = {};
    }

    ctx.session.state.action = 'SELL';
    await ctx.reply(
      'Select coin you want to sell',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('USDT(ERC-20)', 'coin_USDT_ERC20'),
          Markup.button.callback('USDT(TRC-20)', 'coin_USDT_TRC20'),
        ],
        [
          Markup.button.callback('USDC(ERC-20)', 'coin_USDC_ERC20'),
          Markup.button.callback('USDC(TRC-20)', 'coin_USDC_TRC20'),
        ],
        [
          Markup.button.callback('ETH', 'coin_ETH'),
          Markup.button.callback('BTC', 'coin_BTC'),
        ],
      ]),
    );
  }

  @Command('buy')
  async buy(@Ctx() ctx: Context) {
    this.logger.debug('Buy command handler triggered');

    if (!ctx.session) {
      ctx.session = {
        __scenes: {},
        state: {},
      };
    } else if (!ctx.session.state) {
      ctx.session.state = {};
    }

    ctx.session.state.action = 'BUY';

    await ctx.reply(
      'Select coin you want to buy',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('USDT(ERC-20)', 'coin_USDT_ERC20'),
          Markup.button.callback('USDT(TRC-20)', 'coin_USDT_TRC20'),
        ],
        [
          Markup.button.callback('USDC(ERC-20)', 'coin_USDC_ERC20'),
          Markup.button.callback('USDC(TRC-20)', 'coin_USDC_TRC20'),
        ],
        [
          Markup.button.callback('ETH', 'coin_ETH'),
          Markup.button.callback('BTC', 'coin_BTC'),
        ],
      ]),
    );
  }

  @Command('rates')
  async rates(@Ctx() ctx: Context) {
    const ratesList = Object.entries(CryptoCurrency)
      .map(
        ([_, currency]) =>
          `*${currency}*: *₦${this.ratesService.getCurrentRate(currency)}/USD*`,
      )
      .join('\n');

    await ctx.reply('📊 Current Rates:\n\n' + ratesList, {
      parse_mode: 'Markdown',
    });
  }

  @Command('status')
  async status(@Ctx() ctx: Context) {
    await ctx.reply(
      '🤖 Bot Status: *Active*\n' +
        '📈 24h Volume: *$XXX,XXX*\n' +
        '🔄 Trades: *XXX*\n' +
        '⚡ Response Time: *100ms*\n\n' +
        '💰 Fiat Pool: *₦XX,XXX,XXX*\n' +
        '🪙 Coin Pool:\n' +
        '  • USDT: *XXX,XXX*\n' +
        '  • USDC: *XXX,XXX*\n' +
        '  • BTC: *X.XXX*\n' +
        '  • ETH: *XX.XX*',
      { parse_mode: 'Markdown' },
    );
  }

  @Command('cancel')
  async cancel(@Ctx() ctx: Context) {
    ctx.session = {
      __scenes: {},
      state: {},
    };
    await ctx.reply('Operation cancelled. Use /start to begin again.');
  }

  @Command('confirm')
  async confirm(@Ctx() ctx: Context) {
    if (!ctx.session?.state?.amount || !ctx.session?.state?.selectedCoin) {
      await ctx.reply(
        'No active transaction found. Please start a new transaction.',
      );
      return;
    }

    await ctx.reply(
      '🔍 Verifying payment...\n\n' +
        'Please wait while we confirm your payment. This may take a few minutes.',
    );

    try {
      // Simulate payment verification - in production, implement actual payment verification
      setTimeout(async () => {
        if (ctx.session.state.action === 'BUY') {
          await ctx.reply(
            '✅ Payment confirmed!\n\n' +
              `Sending *${ctx.session.state.amount} ${ctx.session.state.selectedCoin}* to:\n\n` +
              `\`${ctx.session.state.walletAddress}\`\n\n` +
              '🔄 Transaction in progress...\n' +
              'You will receive a confirmation once the transfer is complete.',
            { parse_mode: 'Markdown' },
          );
        }

        // Clear session
        ctx.session = {
          __scenes: {},
          state: {},
        };
      }, 3000);
    } catch (error) {
      this.logger.error('Error confirming payment:', error);
      await ctx.reply(
        'An error occurred while confirming payment. Please contact support.',
      );
    }
  }

  @Action(/coin_(.+)/)
  async handleCoinSelection(@Ctx() ctx: Context) {
    this.logger.debug('Coin selection handler triggered');

    // Clear the coin selection keyboard
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

    if (!ctx.session?.state?.action) {
      this.logger.debug('No action in session state during coin selection');
      await ctx.reply('Please start a new transaction using /buy or /sell');
      return;
    }

    const coin = ctx.match[1] as CryptoCurrency;
    ctx.session.state.selectedCoin = coin;

    this.logger.debug(`Selected coin: ${coin}`);
    this.logger.debug(`Action type: ${ctx.session.state.action}`);
    this.logger.debug(`Session state: ${JSON.stringify(ctx.session.state)}`);

    const maxAmount = ctx.session.state.action === 'BUY' ? 4000 : 2000;
    const actionText = ctx.session.state.action === 'BUY' ? 'buy' : 'sell';

    try {
      await ctx.reply(
        `Selected coin: *${this.ratesService.getCurrencyDisplayName(coin)}*\n\n` +
          `Enter the amount you want to ${actionText}\n` +
          'Eg: 1000\n\n' +
          `*Note: ${maxAmount}USDT is the max amount you can ${actionText}*`,
        { parse_mode: 'Markdown' },
      );

      await ctx.answerCbQuery(
        `Selected ${this.ratesService.getCurrencyDisplayName(coin)}`,
      );
      this.logger.debug('Coin selection completed successfully');
    } catch (error) {
      this.logger.error('Error in coin selection:', error);
      await ctx.reply(
        'An error occurred. Please try again or use /cancel to start over.',
      );
    }
  }

  @Action('continue_transaction')
  async continueTransaction(@Ctx() ctx: Context) {
    const banks = await this.bankService.getBankList();
    const bankButtons = banks.map((bank) => [
      Markup.button.callback(bank.name, `bank_${bank.code}`),
    ]);

    await ctx.reply('Select Bank Name', Markup.inlineKeyboard(bankButtons));
  }

  @Action(/bank_(.+)/)
  async handleBankSelection(@Ctx() ctx: Context) {
    try {
      const bankCode = ctx.match[1];
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

      if (ctx.session.state.action === 'SELL') {
        // Verify bank account details
        const bankDetails = await this.bankService.verifyAccountNumber(
          ctx.session.state.accountNumber,
          bankCode,
        );

        if (!bankDetails) {
          await ctx.reply(
            '❌ Could not verify bank account.\n' +
              'Please check your account number and try again.',
          );
          return;
        }

        // Map selected coin to CryptoCurrency enum format - same as buy flow
        const cryptoMap = {
          USDT_ERC20: 'USDT(ERC-20)',
          USDT_TRC20: 'USDT(TRC-20)',
          USDC_ERC20: 'USDC(ERC-20)',
          USDC_TRC20: 'USDC(TRC-20)',
          ETH: 'ETH',
          BTC: 'BTC',
        };

        const mappedCurrency = cryptoMap[ctx.session.state.selectedCoin];
        if (!mappedCurrency) {
          throw new Error(
            `Invalid cryptocurrency selection: ${ctx.session.state.selectedCoin}`,
          );
        }

        // Create transaction with verified bank details
        const transaction = await this.transactionService.createSellTransaction(
          {
            userId: ctx.from.id,
            amount: ctx.session.state.amount,
            cryptoCurrency: mappedCurrency as CryptoCurrency,
            bankDetails: {
              accountNumber: bankDetails.accountNumber,
              bankCode: bankCode,
              accountName: bankDetails.accountName,
              bankName: bankDetails.bankName,
            },
          },
        );

        // Get network-specific instructions
        const networkInstructions = {
          'USDT(ERC-20)': [
            '• Send only USDT on Ethereum (ERC-20) network',
            '• Sending on other networks will result in loss of funds',
            '• Typical confirmation time: 5-20 minutes',
            '• Required confirmations: 2',
          ],
          'USDT(TRC-20)': [
            '• Send only USDT on TRON (TRC-20) network',
            '• Sending on other networks will result in loss of funds',
            '• Typical confirmation time: 1-3 minutes',
            '• Required confirmations: 2',
          ],
          'USDC(ERC-20)': [
            '• Send only USDC on Ethereum (ERC-20) network',
            '• Sending on other networks will result in loss of funds',
            '• Typical confirmation time: 5-20 minutes',
            '• Required confirmations: 2',
          ],
          'USDC(TRC-20)': [
            '• Send only USDC on TRON (TRC-20) network',
            '• Sending on other networks will result in loss of funds',
            '• Typical confirmation time: 1-3 minutes',
            '• Required confirmations: 2',
          ],
          ETH: [
            '• Send only ETH on Ethereum network',
            '• Typical confirmation time: 5-20 minutes',
            '• Required confirmations: 2',
          ],
          BTC: [
            '• Send only BTC on Bitcoin network',
            '• Typical confirmation time: 10-60 minutes',
            '• Required confirmations: 2',
          ],
        }[mappedCurrency].join('\n');

        await ctx.reply(
          '✅ Bank Account Verified!\n\n' +
            '🏦 Bank Details\n' +
            '------------------------------\n' +
            `Account Name: *${bankDetails.accountName}*\n` +
            `Bank Name: *${bankDetails.bankName}*\n` +
            `Account Number: \`${bankDetails.accountNumber}\`\n` +
            '------------------------------\n\n' +
            '💰 Transaction Details\n' +
            `Amount to Receive: *₦${ctx.session.state.nairaAmount.toLocaleString()}*\n` +
            `You Send: *${transaction.amount} ${mappedCurrency}*\n\n` +
            '📤 Send Crypto To\n' +
            `\`${transaction.walletAddress}\`\n\n` +
            '⚠️ Important Network Requirements\n' +
            networkInstructions +
            '\n\n' +
            '⏱ Time Remaining\n' +
            `${this.formatCountdown(transaction.expiresAt.getTime())}\n\n` +
            '❗ Do not reuse this wallet address',
          { parse_mode: 'Markdown' },
        );

        // Start countdown timer
        this.startExpiryCountdown(ctx, transaction.expiresAt.getTime());

        // Start monitoring for transaction
        this.startTransactionDetection(ctx, transaction.id);
      } else {
        // Handle BUY flow
        try {
          // Map selected coin to CryptoCurrency enum
          const cryptoMap = {
            USDT_ERC20: CryptoCurrency['USDT(ERC-20)'],
            USDT_TRC20: CryptoCurrency['USDT(TRC-20)'],
            USDC_ERC20: CryptoCurrency['USDC(ERC-20)'],
            USDC_TRC20: CryptoCurrency['USDC(TRC-20)'],
            ETH: CryptoCurrency.ETH,
            BTC: CryptoCurrency.BTC,
          };

          const cryptoCurrency = cryptoMap[ctx.session.state.selectedCoin];
          if (!cryptoCurrency) {
            throw new Error(
              `Invalid cryptocurrency selection: ${ctx.session.state.selectedCoin}`,
            );
          }

          // Create transaction with bank code
          const transaction =
            await this.transactionService.createBuyTransaction({
              userId: ctx.from.id,
              amount: ctx.session.state.amount,
              cryptoCurrency,
              walletAddress: ctx.session.state.walletAddress,
            });

          // Get bank name directly from bankCode
          const bank = await this.bankService.getBankByCode(bankCode);
          if (!bank) {
            throw new Error(`Bank with code ${bankCode} not found`);
          }

          // Get network-specific instructions
          const networkInstructions = {
            'USDT(ERC-20)': [
              '• Send only USDT on Ethereum (ERC-20) network',
              '• Sending on other networks will result in loss of funds',
              '• Typical confirmation time: 5-20 minutes',
              '• Required confirmations: 2',
            ],
            'USDT(TRC-20)': [
              '• Send only USDT on TRON (TRC-20) network',
              '• Sending on other networks will result in loss of funds',
              '• Typical confirmation time: 1-3 minutes',
              '• Required confirmations: 2',
            ],
            'USDC(ERC-20)': [
              '• Send only USDC on Ethereum (ERC-20) network',
              '• Sending on other networks will result in loss of funds',
              '• Typical confirmation time: 5-20 minutes',
              '• Required confirmations: 2',
            ],
            'USDC(TRC-20)': [
              '• Send only USDC on TRON (TRC-20) network',
              '• Sending on other networks will result in loss of funds',
              '• Typical confirmation time: 1-3 minutes',
              '• Required confirmations: 2',
            ],
            ETH: [
              '• Send only ETH on Ethereum network',
              '• Typical confirmation time: 5-20 minutes',
              '• Required confirmations: 2',
            ],
            BTC: [
              '• Send only BTC on Bitcoin network',
              '• Typical confirmation time: 10-60 minutes',
              '• Required confirmations: 2',
            ],
          }[cryptoCurrency].join('\n');

          await ctx.reply(
            '💳 *Payment Details*\n' +
              '------------------------------\n' +
              `Bank Name: *${bank.name}*\n` +
              `Account Number: \`${transaction.bankDetails.accountNumber}\`\n` +
              `Account Name: *${transaction.bankDetails.accountName}*\n` +
              '------------------------------\n\n' +
              '💰 *Transaction Details*\n' +
              `Amount to Pay: *₦${ctx.session.state.nairaAmount.toLocaleString()}*\n` +
              `You Get: *${transaction.amount} ${cryptoCurrency}*\n\n` +
              '📤 Send Crypto To\n' +
              `\`${transaction.walletAddress}\`\n\n` +
              '⚠️ Important Network Requirements\n' +
              networkInstructions +
              '\n\n' +
              '⏱ Time Remaining\n' +
              `${this.formatCountdown(transaction.expiresAt.getTime())}\n\n` +
              '❗ Do not reuse this wallet address',
            { parse_mode: 'Markdown' },
          );

          // Start countdown timer
          this.startExpiryCountdown(ctx, transaction.expiresAt.getTime());

          // Start monitoring for transaction
          this.startTransactionDetection(ctx, transaction.id);
        } catch (error) {
          this.logger.error('Error in BUY flow:', error);
          await ctx.reply(
            '❌ An error occurred while processing your transaction.\n' +
              'Please try again or contact support.',
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in handleBankSelection:', error);
      await ctx.reply(
        '❌ An error occurred while verifying your bank account.\n' +
          'Please try again or contact support.',
      );
    }
  }

  private async startExpiryCountdown(ctx: Context, expiryTime: number) {
    const chatId = ctx.chat.id;

    // Clear existing interval if any
    if (this.countdownIntervals.has(chatId)) {
      const existingInterval = this.countdownIntervals.get(chatId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }
      this.countdownIntervals.delete(chatId);
    }

    // Send initial status message and store its message ID
    const initialMessage = await ctx.reply(
      'Transaction pending...\n' +
        'Please complete the transaction before the timer expires.\n\n' +
        `Time remaining: *${this.formatCountdown(expiryTime)}*`,
      { parse_mode: 'Markdown' },
    );

    const messageId = initialMessage.message_id;

    const interval = setInterval(async () => {
      const remaining = expiryTime - Date.now();

      if (remaining <= 0) {
        if (this.countdownIntervals.has(chatId)) {
          const currentInterval = this.countdownIntervals.get(chatId);
          if (currentInterval) {
            clearInterval(currentInterval);
          }
          this.countdownIntervals.delete(chatId);
        }
        await ctx.reply(
          '⚠️ Transaction expired. Please start a new transaction.',
        );
        ctx.session = {
          __scenes: {},
          state: {},
        };
        return;
      }

      const countdown = this.formatCountdown(expiryTime);

      try {
        const statusMessage =
          'Transaction pending...\n' +
          'Please complete the transaction before the timer expires.\n\n' +
          `Time remaining: *${countdown}*`;

        // Use telegram's editMessageText method directly with the stored message ID
        await ctx.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          statusMessage,
          { parse_mode: 'Markdown' },
        );
      } catch (error) {
        this.logger.debug('Edit message error (expected):', error.message);
      }
    }, 1000) as unknown as NodeJS.Timeout;

    // Store the interval
    this.countdownIntervals.set(chatId, interval);

    // Auto-cleanup after expiry time
    setTimeout(() => {
      if (this.countdownIntervals.has(chatId)) {
        const currentInterval = this.countdownIntervals.get(chatId);
        if (currentInterval) {
          clearInterval(currentInterval);
        }
        this.countdownIntervals.delete(chatId);
      }
    }, this.EXPIRY_TIME);
  }

  private async startTransactionDetection(ctx: Context, transactionId: string) {
    const checkInterval = setInterval(async () => {
      try {
        const isConfirmed =
          await this.transactionService.confirmTransaction(transactionId);
        if (isConfirmed) {
          clearInterval(checkInterval);
          await ctx.reply(
            '✅ Transaction Confirmed!\n\n' +
              'Your bank transfer has been initiated.\n' +
              'You will receive a confirmation message once completed.',
          );
        }
      } catch (error) {
        this.logger.error('Error checking transaction:', error);
      }
    }, 30000); // Check every 30 seconds

    // Clear interval after 30 minutes
    setTimeout(() => clearInterval(checkInterval), 30 * 60 * 1000);
  }

  private formatCountdown(expiryTime: number): string {
    const remaining = expiryTime - Date.now();
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `⏱ ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  @Action('cancel_transaction')
  async cancelTransaction(@Ctx() ctx: Context) {
    const chatId = ctx.chat.id;
    if (this.countdownIntervals.has(chatId)) {
      const currentInterval = this.countdownIntervals.get(chatId);
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      this.countdownIntervals.delete(chatId);
    }

    ctx.session = {
      __scenes: {},
      state: {},
    };
    await ctx.reply('Transaction cancelled. Use /start to begin again.');
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    // Check if message exists and is a text message
    if (!('text' in ctx.message)) {
      this.logger.debug('Message is not text');
      return;
    }

    // Handle keyboard buttons first
    switch (ctx.message.text) {
      case '💰 Buy':
        this.logger.debug('Buy button pressed');
        return this.buy(ctx);
      case '💱 Sell':
        this.logger.debug('Sell button pressed');
        return this.sell(ctx);
      case '📊 Rates':
        this.logger.debug('Rates button pressed');
        return this.rates(ctx);
      case '📈 Status':
        this.logger.debug('Status button pressed');
        return this.status(ctx);
      case '❌ Cancel':
        this.logger.debug('Cancel button pressed');
        return this.cancel(ctx);
    }

    // Skip if the message is a command
    if (ctx.message.text.startsWith('/')) {
      this.logger.debug('Skipping command message in text handler');
      return;
    }

    this.logger.debug(`Received text: ${ctx.message.text}`);
    this.logger.debug(
      `Current session state: ${JSON.stringify(ctx.session?.state)}`,
    );

    // Ensure session state exists
    if (!ctx.session?.state) {
      this.logger.debug('No session state');
      return;
    }

    // Handle specific input states
    if (ctx.session.state.awaitingAccountNumber) {
      this.logger.debug('Processing account number input');
      const accountNumber = ctx.message.text.trim();
      if (!accountNumber.match(/^\d{10}$/)) {
        await ctx.reply(
          'Invalid account number. Please enter a valid 10-digit account number.',
        );
        return;
      }
      ctx.session.state.accountNumber = accountNumber;

      const banks = await this.bankService.getBankList();
      const bankButtons = banks.map((bank) => [
        Markup.button.callback(bank.name, `bank_${bank.code}`),
      ]);

      await ctx.reply('Select your bank:', Markup.inlineKeyboard(bankButtons));
      return;
    }

    if (ctx.session.state.awaitingWalletAddress) {
      this.logger.debug('Processing wallet address input');
      const walletAddress = ctx.message.text.trim();

      // Update wallet address validation to support different crypto formats
      let isValidAddress = false;
      const coin = ctx.session.state.selectedCoin;

      if (coin.includes('ERC20') || coin === 'ETH') {
        isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
      } else if (coin.includes('TRC20')) {
        isValidAddress = /^T[A-Za-z1-9]{33}$/.test(walletAddress);
      } else if (coin === 'BTC') {
        isValidAddress = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(
          walletAddress,
        );
      }

      if (!isValidAddress) {
        await ctx.reply(
          `Invalid ${coin} wallet address. Please enter a valid address.`,
        );
        return;
      }

      ctx.session.state.walletAddress = walletAddress;
      ctx.session.state.awaitingWalletAddress = false;

      // Create buy transaction and get payment details
      try {
        // Map selected coin to CryptoCurrency enum format
        const cryptoMap = {
          USDT_ERC20: 'USDT(ERC-20)',
          USDT_TRC20: 'USDT(TRC-20)',
          USDC_ERC20: 'USDC(ERC-20)',
          USDC_TRC20: 'USDC(TRC-20)',
          ETH: 'ETH',
          BTC: 'BTC',
        };

        const mappedCurrency = cryptoMap[ctx.session.state.selectedCoin];
        if (!mappedCurrency) {
          throw new Error(
            `Invalid cryptocurrency selection: ${ctx.session.state.selectedCoin}`,
          );
        }

        // Create initial transaction
        const transaction = await this.transactionService.createBuyTransaction({
          userId: ctx.from.id,
          amount: ctx.session.state.amount,
          cryptoCurrency: mappedCurrency as CryptoCurrency,
          walletAddress: walletAddress,
        });

        // Get payment details from Paystack
        const paymentDetails =
          await this.paystackService.initiateBankTransferCharge({
            email: 'customer@example.com', // You might want to collect this from user
            amount: ctx.session.state.nairaAmount,
            reference: `BUY-${transaction.id}`,
          });

        // Update transaction with bank details
        transaction.bankDetails = {
          accountNumber: paymentDetails.accountNumber,
          accountName: paymentDetails.accountName,
          bankCode: paymentDetails.bank.id.toString(),
          bankName: paymentDetails.bank.name,
        };
        await this.transactionRepository.save(transaction);

        await ctx.reply(
          '💳 *Payment Details*\n' +
            '------------------------------\n' +
            `Bank Name: *${paymentDetails.bank.name}*\n` +
            `Account Number: \`${paymentDetails.accountNumber}\`\n` +
            `Account Name: *${paymentDetails.accountName}*\n` +
            '------------------------------\n\n' +
            '💰 *Transaction Details*\n' +
            `Amount to Pay: *₦${ctx.session.state.nairaAmount.toLocaleString()}*\n` +
            `You Get: *${transaction.amount} ${mappedCurrency}*\n\n` +
            '⚠️ *Important*\n' +
            '• Make transfer within 30 minutes\n' +
            '• Use /confirm after payment\n' +
            '• Transaction expires in 30 minutes\n\n' +
            '❗ Do not close this chat until transaction is complete',
          { parse_mode: 'Markdown' },
        );

        // Start countdown timer
        this.startExpiryCountdown(
          ctx,
          new Date(paymentDetails.expiresAt).getTime(),
        );
      } catch (error) {
        this.logger.error('Error creating buy transaction:', error);
        await ctx.reply(
          '❌ An error occurred while processing your transaction.\n' +
            'Please try again or contact support.',
        );
      }
      return;
    }

    // Now check for action and selectedCoin for amount input
    if (!ctx.session.state.action || !ctx.session.state.selectedCoin) {
      this.logger.debug('No action or selected coin in session state');
      return;
    }

    // Handle amount input
    const amount = parseFloat(ctx.message.text);
    this.logger.debug(`Parsed amount: ${amount}`);

    if (ctx.session.state.action === 'SELL') {
      this.logger.debug(`Processing SELL with amount: ${amount}`);

      if (isNaN(amount) || amount <= 0 || amount > 2000) {
        await ctx.reply(
          'Invalid amount. Please enter a number between 0 and 2000.',
        );
        return;
      }

      const rate = this.ratesService.getCurrentRate(
        ctx.session.state.selectedCoin,
      );
      const fiatAmount = this.ratesService.calculateFiatAmount(
        amount,
        ctx.session.state.selectedCoin,
      );

      this.logger.debug(`Rate: ${rate}, Calculated fiat amount: ${fiatAmount}`);

      ctx.session.state.amount = amount;
      ctx.session.state.nairaAmount = fiatAmount;

      await ctx.reply(
        `Current Rate: *₦${rate.toLocaleString()}/USD*\n` +
          `You send: *${amount.toLocaleString()} ${this.ratesService.getCurrencyDisplayName(ctx.session.state.selectedCoin)}*\n` +
          `You get: *₦${fiatAmount.toLocaleString()}*\n\n` +
          'Please enter your account number:',
        { parse_mode: 'Markdown' },
      );
      ctx.session.state.awaitingAccountNumber = true;
      this.logger.debug('Awaiting account number');
    } else if (ctx.session.state.action === 'BUY') {
      this.logger.debug(`Processing BUY with amount: ${amount}`);

      if (isNaN(amount) || amount <= 0 || amount > 4000) {
        await ctx.reply(
          'Invalid amount. Please enter a number between 0 and 4000.',
        );
        return;
      }

      const rate = this.ratesService.getCurrentRate(
        ctx.session.state.selectedCoin,
      );
      const fiatAmount = this.ratesService.calculateFiatAmount(
        amount,
        ctx.session.state.selectedCoin,
      );

      this.logger.debug(`Rate: ${rate}, Calculated fiat amount: ${fiatAmount}`);

      ctx.session.state.amount = amount;
      ctx.session.state.nairaAmount = fiatAmount;

      await ctx.reply(
        `Current Rate: *₦${rate.toLocaleString()}/USD*\n` +
          `You send: *₦${fiatAmount.toLocaleString()}*\n` +
          `You get: *${amount.toLocaleString()} ${this.ratesService.getCurrencyDisplayName(ctx.session.state.selectedCoin)}*\n\n` +
          'Enter your wallet address:',
        { parse_mode: 'Markdown' },
      );
      ctx.session.state.awaitingWalletAddress = true;
      this.logger.debug('Awaiting wallet address');
    }
  }
}
