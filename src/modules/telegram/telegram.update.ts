import { Update, Ctx, Start, Command, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionStatus, CryptoCurrency } from '../transaction/interfaces/transaction.interface';
import { BankDetailsDto } from '../transaction/dto/bank-details.dto';
import { Logger } from '@nestjs/common';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  
  constructor(private readonly transactionService: TransactionService) {
    this.logger.log('TelegramUpdate initialized');
  }

  @Start()
  async start(@Ctx() ctx: Context) {
    this.logger.log(`Received /start command from user ${ctx.from.id}`);
    await ctx.reply(
      'Welcome to HooprX Bot!\n\n' +
      'Use /sell command to sell your crypto.\n' +
      'Format: /sell <amount> <crypto>/NGN\n' +
      'Example: /sell 10 USDT/NGN'
    );
  }

  @Command('sell')
  async sell(@Ctx() ctx: Context) {
    try {
      const message = ctx.message as { text: string };
      const [_, amount, pair] = message.text.split(' ');
      const [crypto, fiat] = pair.split('/');

      if (!amount || !crypto || !fiat) {
        await ctx.reply('Invalid format. Please use: /sell <amount> <crypto>/NGN');
        return;
      }

      const transaction = await this.transactionService.createTransaction({
        userId: ctx.from.id,
        amount: parseFloat(amount),
        cryptoCurrency: crypto as CryptoCurrency,
        fiatCurrency: fiat,
      });

      await ctx.reply(
        `Please send ${amount} ${crypto} to the following address:\n\n` +
        `\`${transaction.walletAddress}\`\n\n` +
        'After sending, use /confirm to confirm your transaction.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await ctx.reply('An error occurred. Please try again.');
    }
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    try {
      // 1. Get the user's latest confirmed transaction
      const transaction = await this.transactionService.getLatestPendingTransaction(ctx.from.id);
      
      if (!transaction || transaction.status !== TransactionStatus.CONFIRMED) {
        return;
      }

      // 2. Parse bank details from message
      const message = ctx.message as { text: string };
      const bankDetails = BankDetailsDto.fromMessage(message.text);
      if (!bankDetails) {
        await ctx.reply('Invalid bank details format...');
        return;
      }

      // 3. Update transaction with bank details
      await this.transactionService.updateBankDetails(transaction.id, bankDetails);
      await ctx.reply('Bank details received! We will process your payment shortly.');
    } catch (error) {
      await ctx.reply('An error occurred. Please try again.');
    }
  }

  @Command('confirm')
  async confirm(@Ctx() ctx: Context) {
    try {
      // 1. Get the user's latest pending transaction
      const transaction = await this.transactionService.getLatestPendingTransaction(ctx.from.id);
      
      if (!transaction) {
        await ctx.reply('No pending transaction found. Please start a new transaction with /sell');
        return;
      }

      // 2. Verify the payment
      const isConfirmed = await this.transactionService.confirmTransaction(transaction.id);

      if (isConfirmed) {
        // 3. If payment is confirmed, prompt for bank details
        await ctx.reply(
          'Transaction confirmed! Please provide your bank details in the following format:\n\n' +
          'Bank Name: <bank_name>\n' +
          'Account Number: <account_number>\n' +
          'Account Name: <account_name>'
        );
      } else {
        await ctx.reply('Transaction not found or payment not received. Please try again.');
      }
    } catch (error) {
      await ctx.reply('An error occurred. Please try again.');
    }
  }
}