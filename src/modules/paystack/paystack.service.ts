import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import moment from 'moment';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly API_BASE = 'https://api.paystack.co';
  private readonly headers: HeadersInit;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    this.headers = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  // For SELL crypto flow - we send money to customer via transfer
  async createTransferRecipient(data: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  }) {
    try {
      const response = await fetch(`${this.API_BASE}/transferrecipient`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          type: 'nuban',
          name: data.accountName,
          account_number: data.accountNumber,
          bank_code: data.bankCode,
          currency: 'NGN',
        }),
      });

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data.recipient_code;
    } catch (error) {
      this.logger.error('Error creating transfer recipient:', error);
      throw new Error('Failed to create transfer recipient');
    }
  }

  async initiateTransfer(data: {
    amount: number;
    recipient: string;
    reference: string;
  }) {
    try {
      const response = await fetch(`${this.API_BASE}/transfer`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          source: 'balance',
          amount: Math.round(data.amount * 100), // Convert to kobo
          recipient: data.recipient,
          reason: `HopprX Crypto Sale - ${data.reference}`,
          reference: data.reference,
          currency: 'NGN',
        }),
      });

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        transferCode: result.data.transfer_code,
        reference: result.data.reference,
        status: result.data.status,
      };
    } catch (error) {
      this.logger.error('Error initiating transfer:', error);
      throw new Error('Failed to initiate transfer');
    }
  }

  async verifyTransfer(reference: string) {
    try {
      const response = await fetch(
        `${this.API_BASE}/transfer/verify/${reference}`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        status: result.data.status,
        amount: result.data.amount / 100, // Convert from kobo
        reference: result.data.reference,
      };
    } catch (error) {
      this.logger.error('Error verifying transfer:', error);
      throw new Error('Failed to verify transfer');
    }
  }

  // For BUY crypto flow - we receive money from customer via charge
  async initiateCharge(data: {
    email: string;
    amount: number;
    reference?: string;
  }) {
    try {
      const response = await fetch(`${this.API_BASE}/charge`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          email: data.email,
          amount: Math.round(data.amount * 100), // Convert to kobo
          reference: data.reference,
          currency: 'NGN',
          channels: [
            'card',
            'bank',
            'ussd',
            'qr',
            'mobile_money',
            'bank_transfer',
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        reference: result.data.reference,
        accessCode: result.data.access_code,
        authorizationUrl: result.data.authorization_url,
      };
    } catch (error) {
      this.logger.error('Error initiating charge:', error);
      throw new Error('Failed to initiate charge');
    }
  }

  async verifyCharge(reference: string) {
    try {
      const response = await fetch(
        `${this.API_BASE}/charge/verify/${reference}`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        status: result.data.status,
        amount: result.data.amount / 100, // Convert from kobo
        reference: result.data.reference,
        channel: result.data.channel,
        paidAt: result.data.paid_at,
      };
    } catch (error) {
      this.logger.error('Error verifying charge:', error);
      throw new Error('Failed to verify charge');
    }
  }

  async initiateBankTransferCharge(data: {
    email: string;
    amount: number;
    reference?: string;
  }): Promise<{
    accountName: string;
    accountNumber: string;
    bank: {
      slug: string;
      name: string;
      id: number;
    };
    reference: string;
    expiresAt: string;
  }> {
    try {
      const payload = {
        email: data.email,
        amount: Math.round(data.amount * 100), // Convert to kobo
        reference: data.reference,
        currency: 'NGN',
        bank_transfer: {
          account_expires_at: moment().add(30, 'minutes').toISOString(),
        },
      };

      this.logger.debug(
        'Initiating bank transfer charge with payload:',
        payload,
      );

      const response = await fetch(`${this.API_BASE}/charge`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        this.logger.error('Paystack error response:', {
          status: response.status,
          statusText: response.statusText,
          body: responseData,
        });
        throw new Error(
          `Paystack error: ${responseData.message || response.statusText}`,
        );
      }

      this.logger.debug('Paystack response:', responseData);

      if (responseData.data.status !== 'pending_bank_transfer') {
        throw new Error(`Unexpected status: ${responseData.data.status}`);
      }

      return {
        accountName: responseData.data.account_name,
        accountNumber: responseData.data.account_number,
        bank: responseData.data.bank,
        reference: responseData.data.reference,
        expiresAt: responseData.data.account_expires_at,
      };
    } catch (error) {
      this.logger.error('Error initiating bank transfer charge:', {
        error: error.message,
        stack: error.stack,
        data: data,
      });
      throw new Error('Failed to initiate bank transfer');
    }
  }

  // Add this new method to verify bank accounts
  async verifyBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{
    accountNumber: string;
    accountName: string;
    bankId: number;
  } | null> {
    try {
      const response = await fetch(
        `${this.API_BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      const responseData = await response.json();

      if (!response.ok) {
        this.logger.error('Bank verification failed:', {
          status: response.status,
          statusText: response.statusText,
          body: responseData,
        });
        return null;
      }

      return {
        accountNumber: responseData.data.account_number,
        accountName: responseData.data.account_name,
        bankId: responseData.data.bank_id,
      };
    } catch (error) {
      this.logger.error('Error verifying bank account:', {
        error: error.message,
        accountNumber,
        bankCode,
      });
      return null;
    }
  }
}
