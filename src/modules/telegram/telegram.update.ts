import { Update, Ctx, Start, Command, Action, On } from 'nestjs-telegraf';
import { Context } from './interfaces/context.interface';
import { Markup } from 'telegraf';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionStatus, CryptoCurrency } from '../transaction/interfaces/transaction.interface';
import { BankDetailsDto } from '../transaction/dto/bank-details.dto';
import { Logger } from '@nestjs/common';
import { RatesService } from '../rates/rates.service';
import { BankService } from '../bank/bank.service';
import * as moment from 'moment';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  private readonly EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor(
    private readonly transactionService: TransactionService,
    private readonly ratesService: RatesService,
    private readonly bankService: BankService,
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
        ['❌ Cancel']
      ])
      .resize()
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

    await ctx.reply('📊 Current Rates:\n\n' + ratesList, { parse_mode: 'Markdown' });
  }

  @Command('status')
  async status(@Ctx() ctx: Context) {
    await ctx.reply(
      '🤖 Bot Status: Active\n' +
        '📈 24h Volume: $XXX,XXX\n' +
        '🔄 Trades: XXX\n' +
        '⚡ Response Time: XXms',
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
              '🔄 Transaction in progress...\n\n' +
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
        { parse_mode: 'Markdown' }
      );

      await ctx.answerCbQuery(`Selected ${this.ratesService.getCurrencyDisplayName(coin)}`);
      this.logger.debug('Coin selection completed successfully');
    } catch (error) {
      this.logger.error('Error in coin selection:', error);
      await ctx.reply('An error occurred. Please try again or use /cancel to start over.');
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
    const bankCode = ctx.match[1];
    
    // Clear the bank selection keyboard
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    
    // Get bank name from code and show confirmation
    const banks = await this.bankService.getBankList();
    const selectedBank = banks.find(bank => bank.code === bankCode);
    await ctx.reply(`Selected bank: *${selectedBank.name}*`, { parse_mode: 'Markdown' });
    
    if (ctx.session.state.action === 'BUY') {
      try {
        // Map network-specific tokens to base currencies using the enum
        let cryptoCurrency: CryptoCurrency;
        
        if (ctx.session.state.selectedCoin.startsWith('USDT')) {
          cryptoCurrency = 'USDT' as CryptoCurrency;
        } else if (ctx.session.state.selectedCoin.startsWith('USDC')) {
          cryptoCurrency = 'USDC' as CryptoCurrency;
        } else if (ctx.session.state.selectedCoin === 'BTC') {
          cryptoCurrency = 'BTC' as CryptoCurrency;
        } else if (ctx.session.state.selectedCoin === 'ETH') {
          cryptoCurrency = 'ETH' as CryptoCurrency;
        } else {
          throw new Error('Unsupported cryptocurrency');
        }

        this.logger.debug('Creating buy transaction with data:', {
          userId: ctx.from.id,
          amount: ctx.session.state.amount,
          cryptoCurrency,
          walletAddress: ctx.session.state.walletAddress
        });

        // Create buy transaction with proper enum value
        const transaction = await this.transactionService.createBuyTransaction({
          userId: ctx.from.id,
          amount: ctx.session.state.amount,
          cryptoCurrency,
          walletAddress: ctx.session.state.walletAddress
        });

        // Get bank details for payment
        const paymentDetails = this.bankService.getTestBankAccount('buy');

        await ctx.reply(
          'Please confirm the transaction details:\n\n' +
          '------------------------------\n' +
          `Amount to Send: *₦${ctx.session.state.nairaAmount.toLocaleString()}*\n` +
          `You will receive: *${transaction.amount} ${this.ratesService.getCurrencyDisplayName(transaction.cryptoCurrency)}*\n` +
          'Wallet Address:\n' +
          `\`${transaction.walletAddress}\`\n` +
          '------------------------------\n\n' +
          'Make payment to:\n' +
          `Account Name: *${paymentDetails.accountName}*\n` +
          `Bank: *${paymentDetails.bankName}*\n` +
          'Account Number:\n' +
          `\`${paymentDetails.accountNumber}\`\n\n` +
          'Note: Crypto will be sent to your wallet immediately after payment confirmation.\n\n' +
          'Use /confirm after making the payment.\n\n' +
          'This quote expires in 30 minutes.\n\n' +
          `*${this.formatCountdown(transaction.expiresAt.getTime())}*`,
          { parse_mode: 'Markdown' }
        );

        // Start countdown timer
        this.startExpiryCountdown(ctx, transaction.expiresAt.getTime());
        
      } catch (error) {
        this.logger.error('Error creating buy transaction:', error);
        await ctx.reply('An error occurred. Please try again or contact support.');
      }
      return;
    }

    // Handle SELL flow
    const bankDetails = await this.bankService.verifyAccountNumber(
      ctx.session.state.accountNumber,
      bankCode
    );

    if (!bankDetails) {
      await ctx.reply('Could not verify bank account. Please try again.');
      return;
    }

    try {
      // Create sell transaction
      const transaction = await this.transactionService.createSellTransaction({
        userId: ctx.from.id,
        amount: ctx.session.state.amount,
        cryptoCurrency: ctx.session.state.selectedCoin as CryptoCurrency,
        bankDetails: {
          accountNumber: bankDetails.accountNumber,
          bankCode: bankCode,
          accountName: bankDetails.accountName,
        },
      });

      await ctx.reply(
        'Please confirm that the bank account details provided is correct\n\n' +
          '------------------------------\n' +
          `Account Name: *${bankDetails.accountName}*\n` +
          `Bank Name: *${bankDetails.bankName}*\n` +
          `Account Number: \`${bankDetails.accountNumber}\`\n` +
          '------------------------------\n\n' +
          `To proceed, send *${transaction.amount} ${transaction.cryptoCurrency}* to the address below:\n\n` +
          `\`${transaction.walletAddress}\`\n\n` +
          'Note: A transfer to your bank account will be initiated immediately after 2 confirmations.\n\n' +
          'This address expires after 30mins. Do not re-use\n\n' +
          `*${this.formatCountdown(transaction.expiresAt.getTime())}*`,
        { parse_mode: 'Markdown' },
      );

      // Start countdown timer
      this.startExpiryCountdown(ctx, transaction.expiresAt.getTime());

      // Start transaction detection
      this.startTransactionDetection(ctx, transaction.id);
    } catch (error) {
      await ctx.reply(
        'An error occurred. Please try again or contact support.',
      );
      this.logger.error('Error creating sell transaction:', error);
    }
  }

  private startExpiryCountdown(ctx: Context, expiryTime: number) {
    const interval = setInterval(async () => {
      const remaining = expiryTime - Date.now();
      if (remaining <= 0) {
        clearInterval(interval);
        await ctx.reply('Transaction expired. Please start a new transaction.');
        ctx.session = {
          __scenes: {},
          state: {},
        };
      } else {
        await ctx.editMessageText(
          // ... previous message content ...
          `** ${this.formatCountdown(expiryTime)} **`,
        );
      }
    }, 1000);
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
    const duration = moment.duration(expiryTime - Date.now());
    return `${duration.minutes().toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
  }

  @Action('cancel_transaction')
  async cancelTransaction(@Ctx() ctx: Context) {
    ctx.session = {
      __scenes: {},
      state: {},
    };
    await ctx.reply('Transaction cancelled. Use /start to begin again.');
  }

  @Action('continue_buy')
  async continueBuy(@Ctx() ctx: Context) {
    await ctx.reply(
      `Enter your ${ctx.session.state.selectedCoin} address\n\n` +
        'Please make sure to enter the correct address as transactions cannot be reversed.',
    );
    ctx.session.state.awaitingWalletAddress = true;
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
    this.logger.debug(`Current session state: ${JSON.stringify(ctx.session?.state)}`);

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

      const banks = await this.bankService.getBankList();
      const bankButtons = banks.map((bank) => [
        Markup.button.callback(bank.name, `bank_${bank.code}`),
      ]);

      await ctx.reply(
        'Select your bank to proceed with payment:',
        Markup.inlineKeyboard(bankButtons),
      );
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
        { parse_mode: 'Markdown' }
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
        { parse_mode: 'Markdown' }
      );
      ctx.session.state.awaitingWalletAddress = true;
      this.logger.debug('Awaiting wallet address');
    }
  }
}