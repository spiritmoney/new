export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED'
}

export enum CryptoCurrency {
  USDT_ERC20 = 'USDT(ERC-20)',
  USDT_TRC20 = 'USDT(TRC-20)',
  USDC_ERC20 = 'USDC(ERC-20)',
  USDC_TRC20 = 'USDC(TRC-20)',
  ETH = 'ETH',
  BTC = 'BTC'
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export interface Transaction {
  id: string;
  userId: number;
  amount: number;
  fiatAmount: number;
  cryptoCurrency: CryptoCurrency;
  fiatCurrency: string;
  status: TransactionStatus;
  type: TransactionType;
  walletAddress: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  email?: string;
  bankDetails?: {
    accountNumber: string;
    bankCode: string;
    accountName?: string;
  };
  paymentReference?: string;
  transferReference?: string;
  transferStatus?: string;
  authorizationUrl?: string;
} 