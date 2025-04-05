# Arbitrage Bot (ARBT)

A comprehensive arbitrage bot that combines both Ethereum/EVM smart contract arbitrage and Solana arbitrage capabilities.

## Overview

This project aims to perform arbitrage across different blockchains:

1. **EVM Smart Contract Arbitrage**: Flash loan-based arbitrage between DEXes on Ethereum and other EVM chains
2. **Solana Arbitrage**: Cross-DEX arbitrage on Solana using Jupiter aggregator

## Project Structure

```
├── evm/                # Ethereum/EVM arbitrage components
│   ├── contracts/      # Smart contracts for flash loan arbitrage
│   ├── scripts/        # Scripts to deploy and interact with contracts
│   └── bot/            # Bot for monitoring and executing arbitrage opportunities
│
├── solana/             # Solana arbitrage components
│   ├── programs/       # On-chain Solana programs (if needed)
│   └── bot/            # Solana arbitrage bot logic
│
└── shared/             # Shared utilities and configuration
    └── config/         # Configuration files
```

## Features

- Flash loan-based arbitrage on Ethereum/EVM chains
- DEX arbitrage across Uniswap, Sushiswap, etc.
- Solana cross-DEX arbitrage using Jupiter aggregator
- Automated profit calculation and execution
- Optional MEV bundling for higher success rate

## Installation

### Prerequisites

- Node.js (v16+)
- Yarn or npm
- Rust and Solana CLI (for Solana components)
- Foundry/Hardhat (for EVM components)

### Setup

```bash
# Clone the repository
git clone https://github.com/MahmoudFahmy527/arbt-bot.git
cd arbt-bot

# Install dependencies for EVM components
cd evm
yarn install

# Install dependencies for Solana components
cd ../solana
yarn install
```

## Configuration

Create `.env` files in both the `evm` and `solana` directories based on the provided templates.

## Usage

Detailed usage instructions coming soon.

## License

MIT