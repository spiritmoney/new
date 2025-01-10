export default () => ({
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
  blockchain: {
    provider: process.env.BLOCKCHAIN_PROVIDER,
  },
  wallet: {
    address: process.env.WALLET_ADDRESS,
    privateKey: process.env.WALLET_PRIVATE_KEY,
  },
  tokens: {
    'USDT(ERC-20)': {
      address: process.env.USDT_ERC20_CONTRACT,
    },
    'USDT(TRC-20)': {
      address: process.env.USDT_TRC20_CONTRACT,
    },
    'USDC(ERC-20)': {
      address: process.env.USDC_ERC20_CONTRACT,
    },
    'USDC(TRC-20)': {
      address: process.env.USDC_TRC20_CONTRACT,
    },
    'ETH': {
      address: process.env.ETH_CONTRACT,
    },
    'BTC': {
      address: process.env.BTC_CONTRACT,
    },
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
  },
});
