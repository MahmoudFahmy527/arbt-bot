# ARBT Bot Usage Guide

This guide provides detailed instructions on how to set up and use the ARBT arbitrage bot on both EVM chains and Solana.

## Prerequisites

Before starting, ensure you have:

1. Node.js (v16+) installed
2. Yarn package manager installed
3. Rust and Solana CLI (for Solana components)
4. Sufficient tokens on the desired chains for testing

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/MahmoudFahmy527/arbt-bot.git
cd arbt-bot
yarn install:all
```

## EVM Arbitrage Setup

The EVM components include a smart contract for flash loan arbitrage and a bot to monitor and execute arbitrage opportunities.

### 1. Configure Environment Variables

Create a `.env` file in the `evm` directory:

```bash
cd evm
cp .env.example .env
```

Edit the `.env` file with:
- `PRIVATE_KEY`: Your Ethereum wallet private key
- `RPC_URL`: A reliable RPC endpoint (Infura, Alchemy, etc.)
- `ETHERSCAN_API_KEY`: For contract verification (optional)

### 2. Deploy the Smart Contract

```bash
yarn compile
yarn deploy
```

Take note of the deployed contract address, and add it to your `.env` file as `CONTRACT_ADDRESS`.

### 3. Run the EVM Arbitrage Bot

```bash
yarn bot
```

The bot will start monitoring price differences between DEXes and execute arbitrage when profitable opportunities are found.

## Solana Arbitrage Setup

The Solana components include a Jupiter-based arbitrage bot and an optional on-chain program.

### 1. Configure Environment Variables

Create a `.env` file in the `solana` directory:

```bash
cd solana
cp bot/.env.example bot/.env
```

Edit the `.env` file with:
- `RPC_URL`: A reliable Solana RPC endpoint
- `SOLANA_PRIVATE_KEY`: Path to your Solana keypair file

### 2. Run the Solana Arbitrage Bot

```bash
yarn start
```

The bot will start monitoring price differences between Solana DEXes via Jupiter and execute arbitrage when profitable opportunities are found.

### 3. (Optional) Deploy the Solana Program

If you want to use the on-chain program for more advanced arbitrage strategies:

```bash
cd programs/arbitrage
cargo build-bpf
solana program deploy target/deploy/arbitrage.so
```

## Advanced Configuration

### Customizing Token Pairs

Edit the token lists in:
- EVM: `evm/bot/index.js`
- Solana: `solana/bot/index.js`
- Shared: `shared/config/tokens.js`

### Adjusting Profit Thresholds

You can modify the profit thresholds in the bot configurations:
- EVM: Change `minProfitThresholdPercent` in `evm/bot/index.js`
- Solana: Change `minProfitThresholdPercent` in `solana/bot/index.js`

### Managing Gas/Transaction Costs

For EVM chains, you can adjust the gas price in `evm/bot/index.js`.

For Solana, the transaction fees are generally very low, but you can adjust priority fees if using Jito or other priority-based services.

## Monitoring & Operations

### Logs

The bots output logs to the console. For production usage, consider using a process manager like PM2 to keep the bots running and capture logs:

```bash
npm install -g pm2
pm2 start evm/bot/index.js --name arbt-evm
pm2 start solana/bot/index.js --name arbt-solana
pm2 logs
```

### Security Considerations

- Never share your private keys or environment files
- Start with small amounts when testing
- Monitor transactions regularly
- Set reasonable profit thresholds to avoid unprofitable transactions

## Troubleshooting

### EVM Common Issues

- **Transaction Reverted**: Usually due to price changes between quote and execution
- **High Gas Costs**: Consider adjusting the gas price or using chains with lower fees
- **Insufficient Liquidity**: Some pairs might not have enough liquidity for meaningful arbitrage

### Solana Common Issues

- **Transaction Timeout**: RPC node might be congested, try a different RPC provider
- **Account Not Found**: Ensure your wallet has the necessary token accounts created
- **Insufficient SOL**: Keep enough SOL for transaction fees

For more detailed information, refer to the README files in each component's directory.
