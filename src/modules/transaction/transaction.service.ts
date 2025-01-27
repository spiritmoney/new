import { Injectable, Inject, Logger } from '@nestjs/common';
import { BankDetailsDto } from './dto/bank-details.dto';
import { ITransactionRepository } from './interfaces/transaction-repository.interface';
import {
  Transaction,
  TransactionStatus,
  CryptoCurrency,
  TransactionType,
} from './interfaces/transaction.interface';
import { WalletService } from '../wallet/wallet.service';
import { v4 as uuidv4 } from 'uuid';
import { TRANSACTION_REPOSITORY } from './constants/transaction.constants';
import { PaystackService } from '../paystack/paystack.service';
import { ethers } from 'ethers';
import { RatesService } from '../rates/rates.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private configService: ConfigService,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    private readonly walletService: WalletService,
    private readonly paystackService: PaystackService,
    private readonly ratesService: RatesService,
  ) {}

  async createTransaction(data: {
    userId: number;
    amount: number;
    cryptoCurrency: CryptoCurrency;
    fiatCurrency: string;
  }): Promise<Transaction> {
    this.validateTransaction(data);

    const walletAddress = await this.walletService.generateAddress();
    const fiatAmount = this.ratesService.calculateFiatAmount(
      data.amount,
      data.cryptoCurrency,
    );

    const transaction: Transaction = {
      id: uuidv4(),
      userId: data.userId,
      amount: data.amount,
      fiatAmount,
      cryptoCurrency: data.cryptoCurrency,
      fiatCurrency: data.fiatCurrency,
      status: TransactionStatus.PENDING,
      type: TransactionType.SELL,
      walletAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    return this.transactionRepository.save(transaction);
  }

  async getLatestPendingTransaction(
    userId: number,
  ): Promise<Transaction | null> {
    return this.transactionRepository.findLatestPendingByUserId(userId);
  }

  async updateBankDetails(
    transactionId: string,
    bankDetails: BankDetailsDto,
  ): Promise<Transaction> {
    const transaction =
      await this.transactionRepository.findById(transactionId);

    if (!transaction || transaction.status !== TransactionStatus.CONFIRMED) {
      throw new Error('Transaction not found or not in correct state');
    }

    transaction.bankDetails = bankDetails;
    transaction.status = TransactionStatus.COMPLETED;
    transaction.updatedAt = new Date();

    return this.transactionRepository.save(transaction);
  }

  async confirmTransaction(transactionId: string): Promise<boolean> {
    const transaction =
      await this.transactionRepository.findById(transactionId);

    if (!transaction || transaction.status !== TransactionStatus.PENDING) {
      return false;
    }

    if (transaction.type === TransactionType.SELL) {
      return this.confirmSellTransaction(transaction);
    } else {
      return this.confirmBuyTransaction(transaction);
    }
  }

  private async confirmSellTransaction(
    transaction: Transaction,
  ): Promise<boolean> {
    // Check crypto balance
    const currentBalance = await this.walletService.checkBalance(
      transaction.walletAddress,
      transaction.cryptoCurrency,
    );

    const expectedAmount = ethers.utils.parseUnits(
      transaction.amount.toString(),
      this.walletService.getTokenDecimals(transaction.cryptoCurrency),
    );

    if (currentBalance.gte(expectedAmount)) {
      // Start payout process
      await this.processSellTransaction(transaction.id);
      return true;
    }

    return false;
  }

  private async confirmBuyTransaction(
    transaction: Transaction,
  ): Promise<boolean> {
    try {
      const chargeStatus = await this.paystackService.verifyCharge(
        transaction.paymentReference,
      );

      if (chargeStatus.status === 'success') {
        // Send crypto to customer
        await this.walletService.sendCrypto(
          transaction.walletAddress,
          transaction.amount,
          transaction.cryptoCurrency,
        );

        transaction.status = TransactionStatus.COMPLETED;
        await this.transactionRepository.save(transaction);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error confirming buy transaction:', error);
      return false;
    }
  }

  async processPayoutToCustomer(transactionId: string): Promise<boolean> {
    const transaction =
      await this.transactionRepository.findById(transactionId);

    if (!transaction || !transaction.bankDetails) {
      throw new Error('Transaction or bank details not found');
    }

    try {
      // 1. Create transfer recipient
      const recipientCode = await this.paystackService.createTransferRecipient({
        accountNumber: transaction.bankDetails.accountNumber,
        bankCode: transaction.bankDetails.bankCode,
        accountName: transaction.bankDetails.accountName,
      });

      // 2. Initiate transfer
      const transferResult = await this.paystackService.initiateTransfer({
        amount: transaction.fiatAmount,
        recipient: recipientCode,
        reference: `TX-${transaction.id}`,
      });

      // 3. Update transaction with transfer details
      transaction.transferReference = transferResult.reference;
      transaction.transferStatus = transferResult.status;
      await this.transactionRepository.save(transaction);

      // 4. Start monitoring transfer status
      this.monitorTransferStatus(transaction.id, transferResult.reference);

      return true;
    } catch (error) {
      transaction.status = TransactionStatus.FAILED;
      await this.transactionRepository.save(transaction);
      throw error;
    }
  }

  private async monitorTransferStatus(
    transactionId: string,
    transferReference: string,
  ) {
    const checkStatus = async () => {
      try {
        const result =
          await this.paystackService.verifyTransfer(transferReference);

        const transaction =
          await this.transactionRepository.findById(transactionId);
        if (!transaction) return;

        transaction.transferStatus = result.status;

        if (['success', 'failed'].includes(result.status)) {
          transaction.status =
            result.status === 'success'
              ? TransactionStatus.COMPLETED
              : TransactionStatus.FAILED;
          await this.transactionRepository.save(transaction);
          return;
        }

        // Check again in 30 seconds if still pending
        setTimeout(checkStatus, 30000);
      } catch (error) {
        // Log error and try again in 1 minute
        setTimeout(checkStatus, 60000);
      }
    };

    // Start checking
    checkStatus();
  }

  private validateTransaction(data: {
    amount: number;
    cryptoCurrency: CryptoCurrency;
    fiatCurrency: string;
  }): void {
    if (data.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (!Object.values(CryptoCurrency).includes(data.cryptoCurrency)) {
      throw new Error('Invalid cryptocurrency');
    }

    if (data.fiatCurrency !== 'NGN') {
      throw new Error('Only NGN is supported');
    }
  }

  // For BUY crypto flow
  async createBuyTransaction(data: {
    userId: number;
    amount: number;
    cryptoCurrency: CryptoCurrency;
    walletAddress: string;
  }): Promise<Transaction> {
    this.validateTransaction({
      amount: data.amount,
      cryptoCurrency: data.cryptoCurrency,
      fiatCurrency: 'NGN',
    });

    const fiatAmount = this.ratesService.calculateFiatAmount(
      data.amount,
      data.cryptoCurrency,
    );

    const transaction: Transaction = {
      id: uuidv4(),
      userId: data.userId,
      amount: data.amount,
      fiatAmount,
      cryptoCurrency: data.cryptoCurrency,
      fiatCurrency: 'NGN',
      status: TransactionStatus.PENDING,
      type: TransactionType.BUY,
      walletAddress: data.walletAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    return this.transactionRepository.save(transaction);
  }

  // For SELL crypto flow
  async createSellTransaction(data: {
    userId: number;
    amount: number;
    cryptoCurrency: CryptoCurrency;
    bankDetails: BankDetailsDto;
  }): Promise<Transaction> {
    // Get the appropriate wallet address based on cryptocurrency
    const walletConfig = this.configService.get('wallet');

    let walletAddress: string;

    switch (data.cryptoCurrency) {
      case CryptoCurrency.BTC:
        walletAddress = walletConfig.BTC.address;
        break;
      case CryptoCurrency.ETH:
        walletAddress = walletConfig.ETH.address;
        break;
      case CryptoCurrency.USDT_ERC20:
      case 'USDT(ERC-20)':
        walletAddress = walletConfig.USDT_ERC20.address;
        break;
      case CryptoCurrency.USDT_TRC20:
      case 'USDT(TRC-20)':
        walletAddress = walletConfig.USDT_TRC20.address;
        break;
      case CryptoCurrency.USDC_ERC20:
      case 'USDC(ERC-20)':
        walletAddress = walletConfig.USDC_ERC20.address;
        break;
      case CryptoCurrency.USDC_TRC20:
      case 'USDC(TRC-20)':
        walletAddress = walletConfig.USDC_TRC20.address;
        break;
      default:
        throw new Error(`Unsupported cryptocurrency: ${data.cryptoCurrency}`);
    }

    if (!walletAddress) {
      throw new Error(
        `No wallet address configured for ${data.cryptoCurrency}`,
      );
    }

    const transaction: Transaction = {
      id: uuidv4(),
      userId: data.userId,
      amount: data.amount,
      fiatAmount: this.ratesService.calculateFiatAmount(
        data.amount,
        data.cryptoCurrency,
      ),
      cryptoCurrency: data.cryptoCurrency,
      fiatCurrency: 'NGN',
      status: TransactionStatus.PENDING,
      type: TransactionType.SELL,
      walletAddress,
      bankDetails: data.bankDetails,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    return this.transactionRepository.save(transaction);
  }

  // For SELL crypto flow
  async processSellTransaction(transactionId: string): Promise<boolean> {
    const transaction =
      await this.transactionRepository.findById(transactionId);

    if (!transaction || !transaction.bankDetails) {
      throw new Error('Transaction or bank details not found');
    }

    try {
      // 1. Create transfer recipient
      const recipientCode = await this.paystackService.createTransferRecipient({
        accountNumber: transaction.bankDetails.accountNumber,
        bankCode: transaction.bankDetails.bankCode,
        accountName: transaction.bankDetails.accountName,
      });

      // 2. Initiate transfer
      const transferResult = await this.paystackService.initiateTransfer({
        amount: transaction.fiatAmount,
        recipient: recipientCode,
        reference: `SELL-${transaction.id}`,
      });

      // 3. Update transaction
      transaction.transferReference = transferResult.reference;
      transaction.transferStatus = transferResult.status;
      await this.transactionRepository.save(transaction);

      // 4. Start monitoring transfer status
      this.monitorTransferStatus(transaction.id, transferResult.reference);

      return true;
    } catch (error) {
      transaction.status = TransactionStatus.FAILED;
      await this.transactionRepository.save(transaction);
      throw error;
    }
  }

  // For BUY crypto flow
  async processBuyTransaction(transactionId: string): Promise<boolean> {
    const transaction =
      await this.transactionRepository.findById(transactionId);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    try {
      // 1. Initiate charge
      const chargeResult = await this.paystackService.initiateCharge({
        email: transaction.email,
        amount: transaction.fiatAmount,
        reference: `BUY-${transaction.id}`,
      });

      // 2. Update transaction
      transaction.paymentReference = chargeResult.reference;
      transaction.authorizationUrl = chargeResult.authorizationUrl;
      await this.transactionRepository.save(transaction);

      return true;
    } catch (error) {
      transaction.status = TransactionStatus.FAILED;
      await this.transactionRepository.save(transaction);
      throw error;
    }
  }
}
