import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaystackService } from '../paystack/paystack.service';
import banksData from '../../../banks.json';
@Injectable()
export class BankService {
  private readonly logger = new Logger(BankService.name);
  private readonly banks: Array<{ name: string; code: string }>;

  constructor(
    private configService: ConfigService,
    private paystackService: PaystackService,
  ) {
    this.banks = banksData.data;
  }

  async getBankList(): Promise<Array<{ name: string; code: string }>> {
    return this.banks;
  }

  public async getBankByCode(
    code: string,
  ): Promise<{ name: string; code: string } | null> {
    const bank = this.banks.find((b) => b.code === code);
    if (!bank) {
      this.logger.warn(`Bank with code ${code} not found`);
      return null;
    }
    return bank;
  }

  async verifyAccountNumber(
    accountNumber: string,
    bankCode: string,
  ): Promise<{
    accountNumber: string;
    accountName: string;
    bankName: string;
  } | null> {
    try {
      const verifiedAccount = await this.paystackService.verifyBankAccount(
        accountNumber,
        bankCode,
      );

      if (!verifiedAccount) {
        return null;
      }

      const bank = await this.getBankByCode(bankCode);
      if (!bank) {
        return null;
      }

      return {
        accountNumber: verifiedAccount.accountNumber,
        accountName: verifiedAccount.accountName,
        bankName: bank.name,
      };
    } catch (error) {
      this.logger.error('Error in verifyAccountNumber:', error);
      return null;
    }
  }

  // For testing purposes
  getTestBankAccount(type: 'sell' | 'buy' = 'sell') {
    return {
      sell: {
        accountName: 'HopprX Limited',
        bankName: 'Kuda Bank',
        accountNumber: '1234567890',
      },
      buy: {
        accountName: 'venture capital',
        bankName: 'Kuda Bank',
        accountNumber: '0123232424242',
      },
    }[type];
  }
}
