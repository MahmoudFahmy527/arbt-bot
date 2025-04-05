const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { Jupiter, RouteInfo } = require('@jup-ag/core');
const JSBI = require('jsbi');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Token addresses for common Solana tokens
const TOKENS = {
  SOL: {
    mint: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    name: 'SOL',
    decimals: 9
  },
  USDC: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    name: 'USDC',
    decimals: 6
  },
  USDT: {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    name: 'USDT',
    decimals: 6
  },
  RAY: {
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    name: 'RAY',
    decimals: 6
  },
  SRM: {
    mint: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
    name: 'SRM',
    decimals: 6
  }
};

// Configuration
const config = {
  rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  privateKeyPath: process.env.SOLANA_PRIVATE_KEY,
  monitoringInterval: 60000, // 1 minute
  minProfitThresholdPercent: 0.5, // 0.5%
  slippageBps: 50, // 0.5% slippage
  initialAmount: 1, // 1 SOL for arbitrage
};

// Load wallet from private key or keypair file
function loadWallet() {
  try {
    if (config.privateKeyPath.endsWith('.json')) {
      // Keypair file
      const keypairData = JSON.parse(fs.readFileSync(config.privateKeyPath, 'utf-8'));
      return Keypair.fromSecretKey(new Uint8Array(keypairData));
    } else {
      // Private key (array or base58)
      const privateKey = config.privateKeyPath.includes('[') 
        ? new Uint8Array(JSON.parse(config.privateKeyPath))
        : Keypair.fromSecretKey(bs58.decode(config.privateKeyPath));
      return privateKey;
    }
  } catch (error) {
    console.error('Error loading wallet:', error);
    throw new Error('Failed to load wallet. Please check your private key configuration.');
  }
}

async function main() {
  // Set up connection
  const connection = new Connection(config.rpcUrl, 'confirmed');
  
  // Load wallet
  const wallet = loadWallet();
  console.log(`Bot wallet: ${wallet.publicKey.toString()}`);
  
  // Get balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Initial balance: ${balance / 1e9} SOL`);
  
  // Initialize Jupiter
  const jupiter = await Jupiter.load({
    connection,
    cluster: 'mainnet-beta',
    user: wallet,
    routeCacheDuration: 0, // Don't cache to get fresh quotes
  });
  
  console.log('Starting Solana arbitrage monitoring bot...');
  
  // Set up monitoring interval
  setInterval(async () => {
    try {
      await monitorArbitrageOpportunities(jupiter, wallet, connection);
    } catch (error) {
      console.error('Error in monitoring loop:', error);
    }
  }, config.monitoringInterval);
}

async function monitorArbitrageOpportunities(jupiter, wallet, connection) {
  console.log('\n--- Checking for Solana arbitrage opportunities ---');
  
  // Define triangular arbitrage paths to check
  const arbitragePaths = [
    // SOL -> USDC -> RAY -> SOL
    [TOKENS.SOL, TOKENS.USDC, TOKENS.RAY, TOKENS.SOL],
    // SOL -> USDC -> SRM -> SOL
    [TOKENS.SOL, TOKENS.USDC, TOKENS.SRM, TOKENS.SOL],
    // SOL -> USDT -> RAY -> SOL
    [TOKENS.SOL, TOKENS.USDT, TOKENS.RAY, TOKENS.SOL],
  ];
  
  for (const path of arbitragePaths) {
    const pathNames = path.map(token => token.name).join(' -> ');
    console.log(`Checking arbitrage path: ${pathNames}`);
    
    try {
      // Calculate potential profit for this path
      const result = await checkTriangularArbitrage(jupiter, path, config.initialAmount);
      
      if (result.profitPercent > config.minProfitThresholdPercent) {
        console.log(`Found profitable arbitrage!`);
        console.log(`Path: ${pathNames}`);
        console.log(`Initial: ${config.initialAmount} ${path[0].name}`);
        console.log(`Final: ${result.finalAmount} ${path[0].name}`);
        console.log(`Profit: ${result.profit} ${path[0].name} (${result.profitPercent.toFixed(4)}%)`);
        
        // Execute the arbitrage if profitable
        // await executeTriangularArbitrage(jupiter, wallet, path, config.initialAmount);
        
        // In a real implementation, you would execute the trades here
        // For safety, this is commented out
      } else {
        console.log(`No profitable arbitrage for ${pathNames}. Profit: ${result.profitPercent.toFixed(4)}%`);
      }
    } catch (error) {
      console.error(`Error checking arbitrage for ${pathNames}:`, error.message);
    }
  }
}

async function checkTriangularArbitrage(jupiter, path, initialAmount) {
  // Calculate the amount in token base units for the first token
  const inputAmount = JSBI.BigInt(initialAmount * (10 ** path[0].decimals));
  let currentAmount = inputAmount;
  
  // Simulate the swaps along the path
  for (let i = 0; i < path.length - 1; i++) {
    const inputToken = path[i];
    const outputToken = path[i + 1];
    
    // Get routes
    const routes = await jupiter.computeRoutes({
      inputMint: new PublicKey(inputToken.mint),
      outputMint: new PublicKey(outputToken.mint),
      amount: currentAmount,
      slippageBps: config.slippageBps,
      forceFetch: true,
    });
    
    if (routes.routesInfos.length === 0) {
      throw new Error(`No routes found for ${inputToken.name} -> ${outputToken.name}`);
    }
    
    // Get best route
    const bestRoute = routes.routesInfos[0];
    currentAmount = bestRoute.outAmount;
  }
  
  // Calculate profit
  const finalAmount = Number(currentAmount) / (10 ** path[0].decimals);
  const profit = finalAmount - initialAmount;
  const profitPercent = (profit / initialAmount) * 100;
  
  return {
    initialAmount,
    finalAmount,
    profit,
    profitPercent,
  };
}

async function executeTriangularArbitrage(jupiter, wallet, path, initialAmount) {
  console.log('Executing triangular arbitrage...');
  
  // Calculate the amount in token base units for the first token
  const inputAmount = JSBI.BigInt(initialAmount * (10 ** path[0].decimals));
  let currentAmount = inputAmount;
  
  // Execute swaps along the path
  for (let i = 0; i < path.length - 1; i++) {
    const inputToken = path[i];
    const outputToken = path[i + 1];
    
    console.log(`Swap ${i + 1}: ${inputToken.name} -> ${outputToken.name}`);
    
    // Get routes
    const routes = await jupiter.computeRoutes({
      inputMint: new PublicKey(inputToken.mint),
      outputMint: new PublicKey(outputToken.mint),
      amount: currentAmount,
      slippageBps: config.slippageBps,
      forceFetch: true,
    });
    
    if (routes.routesInfos.length === 0) {
      throw new Error(`No routes found for ${inputToken.name} -> ${outputToken.name}`);
    }
    
    // Get best route
    const bestRoute = routes.routesInfos[0];
    
    // Execute swap
    try {
      const { execute } = await jupiter.exchange({
        routeInfo: bestRoute,
      });
      
      const result = await execute();
      
      if (result.error) {
        console.error(`Error executing swap ${i + 1}:`, result.error);
        throw new Error(`Swap failed: ${result.error}`);
      }
      
      console.log(`Swap ${i + 1} succeeded. Txid: ${result.txid}`);
      
      // Update current amount for next swap
      currentAmount = bestRoute.outAmount;
    } catch (error) {
      console.error(`Error executing swap ${i + 1}:`, error);
      throw error;
    }
  }
  
  // Calculate final profit
  const finalAmount = Number(currentAmount) / (10 ** path[0].decimals);
  const profit = finalAmount - initialAmount;
  const profitPercent = (profit / initialAmount) * 100;
  
  console.log(`Arbitrage execution completed!`);
  console.log(`Initial: ${initialAmount} ${path[0].name}`);
  console.log(`Final: ${finalAmount} ${path[0].name}`);
  console.log(`Profit: ${profit} ${path[0].name} (${profitPercent.toFixed(4)}%)`);
  
  return {
    initialAmount,
    finalAmount,
    profit,
    profitPercent,
  };
}

// Error handler for unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Start the bot
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  monitorArbitrageOpportunities,
  checkTriangularArbitrage,
  executeTriangularArbitrage
};
