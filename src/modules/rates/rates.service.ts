import { Injectable, Logger } from '@nestjs/common';
import { CryptoCurrency } from '../transaction/interfaces/transaction.interface';

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);
  
  // Define fixed rates for each currency
  private rates = {
    // USDT and USDC are stablecoins pegged to USD
    [CryptoCurrency.USDT_ERC20]: 1500,  // 1 USDT = ₦1500
    [CryptoCurrency.USDT_TRC20]: 1500,  // 1 USDT = ₦1500
    [CryptoCurrency.USDC_ERC20]: 1500,  // 1 USDC = ₦1500
    [CryptoCurrency.USDC_TRC20]: 1500,  // 1 USDC = ₦1500
    [CryptoCurrency.ETH]: 2500000,      // 1 ETH = ₦2,500,000
    [CryptoCurrency.BTC]: 45000000,     // 1 BTC = ₦45,000,000
  };

  getCurrentRate(currency: CryptoCurrency): number {
    // For stablecoins, return the same rate regardless of network
    if (currency.includes('USDT')) {
      return this.rates[CryptoCurrency.USDT_ERC20];
    }
    if (currency.includes('USDC')) {
      return this.rates[CryptoCurrency.USDC_ERC20];
    }

    const rate = this.rates[currency];
    this.logger.debug(`Getting rate for ${currency}: ${rate}`);
    
    if (!rate) {
      this.logger.error(`No rate found for currency: ${currency}`);
      throw new Error(`No rate found for currency: ${currency}`);
    }
    
    return rate;
  }

  calculateFiatAmount(amount: number, currency: CryptoCurrency): number {
    const rate = this.getCurrentRate(currency);
    this.logger.debug(`Calculating fiat amount: ${amount} ${currency} at rate ${rate}`);
    
    const fiatAmount = amount * rate;
    this.logger.debug(`Calculated fiat amount: ${fiatAmount}`);
    
    return fiatAmount;
  }

  // Helper method to get currency display name
  getCurrencyDisplayName(currency: CryptoCurrency): string {
    if (currency.includes('USDT')) return 'USDT';
    if (currency.includes('USDC')) return 'USDC';
    return currency;
  }
} 