import { Transaction } from './transaction.interface';

export interface ITransactionRepository {
  save(transaction: Transaction): Promise<Transaction>;
  findById(id: string): Promise<Transaction | null>;
  findLatestPendingByUserId(userId: number): Promise<Transaction | null>;
} 