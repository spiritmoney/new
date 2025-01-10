import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BankService {
  private readonly logger = new Logger(BankService.name);
  private readonly PAYSTACK_API = 'https://api.paystack.co';
  private readonly headers: HeadersInit;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('paystack.secretKey');
    this.headers = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    };
  }

  async getBankList(): Promise<Array<{ name: string, code: string }>> {
    try {
      const response = await fetch(`${this.PAYSTACK_API}/bank`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data.map(bank => ({
        name: bank.name,
        code: bank.code
      }));
    } catch (error) {
      this.logger.error('Error fetching bank list:', error);
      return [];
    }
  }

  async verifyAccountNumber(accountNumber: string, bankCode: string): Promise<{
    accountName: string;
    accountNumber: string;
    bankName: string;
  } | null> {
    try {
      const response = await fetch(
        `${this.PAYSTACK_API}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          method: 'GET',
          headers: this.headers
        }
      );

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Get bank name from bank code
      const banks = await this.getBankList();
      const bank = banks.find(b => b.code === bankCode);

      return {
        accountName: result.data.account_name,
        accountNumber: accountNumber,
        bankName: bank?.name || 'Unknown Bank'
      };
    } catch (error) {
      this.logger.error('Error verifying account:', error);
      return null;
    }
  }

  // For testing purposes
  getTestBankAccount(type: 'sell' | 'buy' = 'sell') {
    return {
      'sell': {
        accountName: 'HopprX Limited',
        bankName: 'Kuda Bank',
        accountNumber: '1234567890'
      },
      'buy': {
        accountName: 'venture capital',
        bankName: 'Kuda Bank',
        accountNumber: '0123232424242'
      }
    }[type];
  }
} 