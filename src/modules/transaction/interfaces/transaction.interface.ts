export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum CryptoCurrency {
  USDT = 'USDT',
  USDC = 'USDC',
}

export interface Transaction {
  id: string;
  userId: number;
  amount: number;
  cryptoCurrency: CryptoCurrency;
  fiatCurrency: string;
  status: TransactionStatus;
  walletAddress: string;
  createdAt: Date;
  updatedAt: Date;
  bankDetails?: {
    accountNumber: string;
    bankName: string;
    accountName: string;
  };
} 