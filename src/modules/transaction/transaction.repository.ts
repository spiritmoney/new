import { Injectable } from '@nestjs/common';
import { ITransactionRepository } from './interfaces/transaction-repository.interface';
import { Transaction, TransactionStatus } from './interfaces/transaction.interface';

@Injectable()
export class TransactionRepository implements ITransactionRepository {
  private transactions: Transaction[] = [];

  async save(transaction: Transaction): Promise<Transaction> {
    const existingIndex = this.transactions.findIndex(t => t.id === transaction.id);
    if (existingIndex >= 0) {
      this.transactions[existingIndex] = transaction;
    } else {
      this.transactions.push(transaction);
    }
    return transaction;
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.transactions.find(t => t.id === id) || null;
  }

  async findLatestPendingByUserId(userId: number): Promise<Transaction | null> {
    return this.transactions
      .filter(t => t.userId === userId && t.status === TransactionStatus.PENDING)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;
  }
} 