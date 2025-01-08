export default () => ({
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
  wallet: {
    address: process.env.WALLET_ADDRESS,
    privateKey: process.env.WALLET_PRIVATE_KEY,
  },
  blockchain: {
    provider: process.env.BLOCKCHAIN_PROVIDER,
  },
  tokens: {
    USDT: {
      address: process.env.USDT_CONTRACT_ADDRESS,
      decimals: 6
    },
    USDC: {
      address: process.env.USDC_CONTRACT_ADDRESS,
      decimals: 6
    }
  }
});
