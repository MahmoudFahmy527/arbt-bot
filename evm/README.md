# EVM Arbitrage Components

This directory contains the smart contracts and bot implementations for performing arbitrage on Ethereum and other EVM-compatible chains.

## Structure

- `contracts/`: Smart contracts for flash loan arbitrage
- `scripts/`: Deployment and interaction scripts
- `bot/`: Bot for monitoring and executing arbitrage opportunities

## Key Components

### Flash Loan Arbitrage Contract

The core smart contract leverages flash loans from protocols like Aave or dYdX to perform arbitrage between different DEXes without requiring significant capital upfront.

### Arbitrage Strategies

- DEX-to-DEX arbitrage (e.g., Uniswap to Sushiswap)
- Triangular arbitrage across multiple token pairs
- MEV optimization for higher success rates

## Setup

```bash
# Install dependencies
yarn install

# Compile contracts
yarn compile

# Run tests
yarn test
```

## Configuration

Create a `.env` file with the following variables:

```
PRIVATE_KEY=your_private_key
RPC_URL=your_rpc_url
ETHERSCAN_API_KEY=your_etherscan_api_key
```