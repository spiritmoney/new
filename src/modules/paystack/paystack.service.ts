import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly API_BASE = 'https://api.paystack.co';
  private readonly headers: HeadersInit;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    this.headers = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
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
          currency: 'NGN'
        })
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
          currency: 'NGN'
        })
      });

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        transferCode: result.data.transfer_code,
        reference: result.data.reference,
        status: result.data.status
      };
    } catch (error) {
      this.logger.error('Error initiating transfer:', error);
      throw new Error('Failed to initiate transfer');
    }
  }

  async verifyTransfer(reference: string) {
    try {
      const response = await fetch(`${this.API_BASE}/transfer/verify/${reference}`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        status: result.data.status,
        amount: result.data.amount / 100, // Convert from kobo
        reference: result.data.reference
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
          channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
        })
      });

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        reference: result.data.reference,
        accessCode: result.data.access_code,
        authorizationUrl: result.data.authorization_url
      };
    } catch (error) {
      this.logger.error('Error initiating charge:', error);
      throw new Error('Failed to initiate charge');
    }
  }

  async verifyCharge(reference: string) {
    try {
      const response = await fetch(`${this.API_BASE}/charge/verify/${reference}`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Paystack error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        status: result.data.status,
        amount: result.data.amount / 100, // Convert from kobo
        reference: result.data.reference,
        channel: result.data.channel,
        paidAt: result.data.paid_at
      };
    } catch (error) {
      this.logger.error('Error verifying charge:', error);
      throw new Error('Failed to verify charge');
    }
  }
} 