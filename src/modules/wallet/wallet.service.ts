import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { CryptoCurrency } from '../transaction/interfaces/transaction.interface';

@Injectable()
export class WalletService {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(private configService: ConfigService) {
    const providerUrl = this.configService.get<string>('blockchain.provider');
    const privateKey = this.configService.get<string>('wallet.privateKey');

    if (!providerUrl) {
      throw new Error('Blockchain provider URL not configured');
    }

    if (!privateKey) {
      throw new Error('Wallet private key not configured');
    }

    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  async generateAddress(): Promise<string> {
    const address = this.configService.get<string>('wallet.address');
    if (!address) {
      throw new Error('Wallet address not configured');
    }
    return address;
  }

  async checkPayment(
    address: string,
    amount: number,
    currency: CryptoCurrency,
  ): Promise<boolean> {
    try {
      const tokenContract = this.getTokenContract(currency);
      const balance = await tokenContract.balanceOf(address);
      const expectedAmount = ethers.utils.parseUnits(amount.toString(), 6);
      
      return balance.gte(expectedAmount);
    } catch (error) {
      console.error('Error checking payment:', error);
      return false;
    }
  }

  private getTokenContract(currency: CryptoCurrency): ethers.Contract {
    const tokenAddress = this.getTokenAddress(currency);
    if (!tokenAddress) {
      throw new Error(`Token address not configured for ${currency}`);
    }

    const tokenAbi = ['function balanceOf(address) view returns (uint256)'];
    return new ethers.Contract(tokenAddress, tokenAbi, this.provider);
  }

  private getTokenAddress(currency: CryptoCurrency): string {
    const address = this.configService.get<string>(`tokens.${currency}.address`);
    if (!address) {
      throw new Error(`Token address not configured for ${currency}`);
    }
    return address;
  }
} 