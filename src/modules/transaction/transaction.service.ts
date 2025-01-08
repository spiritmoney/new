import { Injectable, Inject } from '@nestjs/common';
import { BankDetailsDto } from './dto/bank-details.dto';
import { ITransactionRepository } from './interfaces/transaction-repository.interface';
import { Transaction, TransactionStatus, CryptoCurrency } from './interfaces/transaction.interface';
import { WalletService } from '../wallet/wallet.service';
import { v4 as uuidv4 } from 'uuid';
import { TRANSACTION_REPOSITORY } from './constants/transaction.constants';

@Injectable()
export class TransactionService {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    private readonly walletService: WalletService,
  ) {}

  async createTransaction(data: {
    userId: number;
    amount: number;
    cryptoCurrency: CryptoCurrency;
    fiatCurrency: string;
  }): Promise<Transaction> {
    this.validateTransaction(data);
    
    const walletAddress = await this.walletService.generateAddress();
    
    const transaction: Transaction = {
      id: uuidv4(),
      userId: data.userId,
      amount: data.amount,
      cryptoCurrency: data.cryptoCurrency,
      fiatCurrency: data.fiatCurrency,
      status: TransactionStatus.PENDING,
      walletAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.transactionRepository.save(transaction);
  }

  async getLatestPendingTransaction(userId: number): Promise<Transaction | null> {
    return this.transactionRepository.findLatestPendingByUserId(userId);
  }

  async updateBankDetails(transactionId: string, bankDetails: BankDetailsDto): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(transactionId);
    
    if (!transaction || transaction.status !== TransactionStatus.CONFIRMED) {
      throw new Error('Transaction not found or not in correct state');
    }

    transaction.bankDetails = bankDetails;
    transaction.status = TransactionStatus.COMPLETED;
    transaction.updatedAt = new Date();

    return this.transactionRepository.save(transaction);
  }

  async confirmTransaction(transactionId: string): Promise<boolean> {
    // 1. Find the transaction
    const transaction = await this.transactionRepository.findById(transactionId);
    
    if (!transaction || transaction.status !== TransactionStatus.PENDING) {
      return false;
    }

    // 2. Check if payment was received using the wallet service
    const isPaymentReceived = await this.walletService.checkPayment(
      transaction.walletAddress,
      transaction.amount,
      transaction.cryptoCurrency,
    );

    if (isPaymentReceived) {
      // 3. Update transaction status to CONFIRMED
      transaction.status = TransactionStatus.CONFIRMED;
      transaction.updatedAt = new Date();
      await this.transactionRepository.save(transaction);
      return true;
    }

    return false;
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
}