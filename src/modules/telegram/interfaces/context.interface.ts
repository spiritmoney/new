import { Context as TelegrafContext, Scenes } from 'telegraf';
import { CryptoCurrency } from '../../transaction/interfaces/transaction.interface';

// Define our custom session data
interface CustomSessionData {
  action?: 'BUY' | 'SELL';
  selectedCoin?: CryptoCurrency;
  amount?: number;
  nairaAmount?: number;
  email?: string;
  accountNumber?: string;
  bankCode?: string;
  walletAddress?: string;
  awaitingWalletAddress?: boolean;
  awaitingAccountNumber?: boolean;
  transactionId?: string;
}

// Create the custom context type
export interface Context extends Scenes.SceneContext {
  session: {
    __scenes: Scenes.SceneSessionData;
    state: CustomSessionData;
  };
  match: RegExpExecArray | null;
} 