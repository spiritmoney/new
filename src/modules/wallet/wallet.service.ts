import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { CryptoCurrency } from '../transaction/interfaces/transaction.interface';

@Injectable()
export class WalletService {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private readonly logger = new Logger(WalletService.name);

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

  async checkBalance(
    address: string,
    currency: CryptoCurrency,
  ): Promise<ethers.BigNumber> {
    try {
      const tokenContract = this.getTokenContract(currency);
      return await tokenContract.balanceOf(address);
    } catch (error) {
      this.logger.error('Error checking balance:', error);
      return ethers.BigNumber.from(0);
    }
  }

  async sendCrypto(
    toAddress: string,
    amount: number,
    currency: CryptoCurrency,
  ): Promise<boolean> {
    try {
      const tokenContract = this.getTokenContract(currency);
      const decimals = this.getTokenDecimals(currency);
      const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
      
      const tx = await tokenContract.connect(this.wallet).transfer(toAddress, amountInWei);
      await tx.wait();
      
      return true;
    } catch (error) {
      this.logger.error('Error sending crypto:', error);
      return false;
    }
  }

  getTokenDecimals(currency: CryptoCurrency): number {
    switch (currency) {
      case CryptoCurrency.USDT_ERC20:
      case CryptoCurrency.USDT_TRC20:
        return 6;
      case CryptoCurrency.ETH:
        return 18;
      default:
        return 8;
    }
  }

  private getTokenContract(currency: CryptoCurrency): ethers.Contract {
    const tokenAddress = this.getTokenAddress(currency);
    if (!tokenAddress) {
      throw new Error(`Token address not configured for ${currency}`);
    }

    const tokenAbi = ['function balanceOf(address) view returns (uint256)', 'function transfer(address to, uint256 amount) returns (bool)'];
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