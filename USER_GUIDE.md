# HopprX Bot User Guide

## Overview
HopprX Bot is a Telegram bot that allows you to instantly buy and sell cryptocurrencies for Nigerian Naira (NGN). The bot supports multiple cryptocurrencies and provides a seamless, incognito trading experience.

## Supported Cryptocurrencies
- USDT (ERC-20)
- USDT (TRC-20)
- USDC (ERC-20)
- USDC (TRC-20)
- ETH
- BTC

## Commands
- `/start` - Start the bot and see available commands
- `/buy` - Start buying cryptocurrency
- `/sell` - Start selling cryptocurrency
- `/rates` - View current exchange rates
- `/status` - Check bot status
- `/cancel` - Cancel current operation

## Transaction Limits
- Buy: Maximum 4,000 USDT equivalent per transaction
- Sell: Maximum 2,000 USDT equivalent per transaction

## How to Sell Cryptocurrency

1. **Start Sell Process**
   - Send `/sell` command
   - Select the cryptocurrency you want to sell from the options

2. **Enter Amount**
   - Type the amount you want to sell
   - Bot will show you the current rate and NGN equivalent
   - Confirm or cancel the transaction

3. **Bank Details**
   - Select your bank from the list
   - Enter your account number
   - Bot will verify and display your account details

4. **Complete Transaction**
   - Send cryptocurrency to the provided wallet address
   - Wait for 2 confirmations
   - Receive NGN in your bank account
   - Transaction expires after 30 minutes if not completed

## How to Buy Cryptocurrency

1. **Start Buy Process**
   - Send `/buy` command
   - Select the cryptocurrency you want to buy

2. **Enter Amount**
   - Type the amount you want to buy
   - Bot will show you the current rate and NGN equivalent
   - Confirm or cancel the transaction

3. **Provide Wallet Address**
   - Enter your cryptocurrency wallet address
   - Double-check the address as transactions cannot be reversed

4. **Make Payment**
   - Send NGN to the provided bank account
   - Use `/confirm` after making payment
   - Wait for confirmation
   - Receive cryptocurrency in your wallet

## Important Notes

### Security
- Never share your private keys
- Always verify bank account details before sending money
- Double-check wallet addresses before confirming transactions

### Transaction Times
- Sell transactions: NGN transfer initiated after 2 blockchain confirmations
- Buy transactions: Crypto sent immediately after payment confirmation
- All transactions expire after 30 minutes if not completed

### Support
If you encounter any issues:
- Use `/cancel` to reset the current operation
- Start a new transaction
- Contact support if problems persist

## Rates and Fees
- Exchange rates are displayed using `/rates` command
- Rates include all fees
- No hidden charges

## Privacy
- Zero data collection policy
- Transactions are incognito
- Only essential transaction details are stored

## Best Practices
1. Always verify transaction details before confirming
2. Keep your wallet address and bank details handy
3. Complete transactions within the 30-minute window
4. Save the bot's payment details for quick access
5. Check rates before starting a transaction

## Error Resolution
If you encounter:
- Invalid wallet address: Double-check format
- Bank verification failed: Confirm account details
- Transaction timeout: Start a new transaction
- Payment issues: Contact support

Remember to keep this guide handy for reference while using the bot. 