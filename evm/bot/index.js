const { ethers } = require("ethers");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load environment variables
dotenv.config();

// Contract ABI
const arbitrageFlashLoanABI = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../artifacts/contracts/ArbitrageFlashLoan.sol/ArbitrageFlashLoan.json"),
    "utf8"
  )
).abi;

// Router ABIs for price checks
const uniswapRouterABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)"
];
const sushiswapRouterABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)"
];

// Tokens to monitor (examples for Ethereum Mainnet)
const tokens = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // Wrapped ETH
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",  // DAI
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // Wrapped BTC
};

// Configuration
const config = {
  rpcUrl: process.env.RPC_URL || "http://localhost:8545",
  privateKey: process.env.PRIVATE_KEY,
  contractAddress: process.env.CONTRACT_ADDRESS,
  uniswapRouterAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  sushiswapRouterAddress: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
  monitoringInterval: 60000, // 1 minute
  minProfitThresholdPercent: 0.5, // 0.5%
  gasPrice: ethers.parseUnits("50", "gwei"), 
  flashLoanAmount: ethers.parseUnits("10", "ether"), // 10 ETH worth
};

async function main() {
  // Set up provider and wallet
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  
  console.log(`Connected to network: ${await provider.getNetwork().then(n => n.name)}`);
  console.log(`Bot address: ${wallet.address}`);
  
  // Contract instances
  const arbitrageContract = new ethers.Contract(
    config.contractAddress,
    arbitrageFlashLoanABI,
    wallet
  );
  
  const uniswapRouter = new ethers.Contract(
    config.uniswapRouterAddress,
    uniswapRouterABI,
    provider
  );
  
  const sushiswapRouter = new ethers.Contract(
    config.sushiswapRouterAddress,
    sushiswapRouterABI,
    provider
  );
  
  console.log("Starting arbitrage monitoring bot...");
  
  // Set up monitoring interval
  setInterval(async () => {
    try {
      await monitorArbitrageOpportunities(
        arbitrageContract,
        uniswapRouter,
        sushiswapRouter,
        wallet
      );
    } catch (error) {
      console.error("Error in monitoring loop:", error);
    }
  }, config.monitoringInterval);
}

async function monitorArbitrageOpportunities(
  arbitrageContract,
  uniswapRouter,
  sushiswapRouter,
  wallet
) {
  console.log("\n--- Checking for arbitrage opportunities ---");
  
  // Check all token pairs for arbitrage
  for (const [tokenName, tokenAddress] of Object.entries(tokens)) {
    if (tokenName === "WETH") continue; // Skip base token
    
    // Define the swap paths (ETH -> Token -> ETH)
    const pathUniToSushi = [tokens.WETH, tokenAddress, tokens.WETH];
    
    // Calculate price differences
    const arbitrageInfo = await calculateArbitrage(
      uniswapRouter,
      sushiswapRouter,
      config.flashLoanAmount,
      pathUniToSushi
    );
    
    if (arbitrageInfo.profitPercent > config.minProfitThresholdPercent) {
      console.log(`Found profitable arbitrage for ${tokenName}!`);
      console.log(`Profit: ${arbitrageInfo.profit} ETH (${arbitrageInfo.profitPercent.toFixed(4)}%)`);
      
      // Execute the arbitrage
      await executeArbitrage(
        arbitrageContract,
        tokens.WETH,
        config.flashLoanAmount,
        tokenAddress,
        wallet
      );
    } else {
      console.log(`${tokenName}: No profitable arbitrage. Profit: ${arbitrageInfo.profitPercent.toFixed(4)}%`);
    }
  }
}

async function calculateArbitrage(
  uniswapRouter,
  sushiswapRouter,
  amount,
  path
) {
  // Step 1: Check how much token we get from Uniswap
  const amountsFromUni = await uniswapRouter.getAmountsOut(amount, [path[0], path[1]]);
  const intermediateAmount = amountsFromUni[1];
  
  // Step 2: Check how much ETH we get back from Sushiswap
  const amountsFromSushi = await sushiswapRouter.getAmountsOut(intermediateAmount, [path[1], path[2]]);
  const finalAmount = amountsFromSushi[1];
  
  // Calculate profit/loss
  const profit = finalAmount - amount;
  const profitPercent = (profit * 100n) / amount;
  
  return {
    profit: ethers.formatEther(profit),
    profitPercent: Number(profitPercent) / 100, // Convert to percentage
    amountIn: ethers.formatEther(amount),
    amountOut: ethers.formatEther(finalAmount),
  };
}

async function executeArbitrage(
  arbitrageContract,
  tokenBorrow,
  amount,
  intermediateToken,
  wallet
) {
  console.log("Executing arbitrage transaction...");
  
  try {
    // Estimate gas
    const gasEstimate = await arbitrageContract.executeArbitrage.estimateGas(
      tokenBorrow,
      amount,
      intermediateToken
    );
    
    console.log(`Estimated gas: ${gasEstimate}`);
    
    // Add 20% buffer to gas estimate
    const gasLimit = gasEstimate * 120n / 100n;
    
    // Execute transaction
    const tx = await arbitrageContract.executeArbitrage(
      tokenBorrow,
      amount,
      intermediateToken,
      {
        gasLimit,
        gasPrice: config.gasPrice
      }
    );
    
    console.log(`Transaction sent: ${tx.hash}`);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed}`);
    
    // Check for arbitrage event
    const arbitrageEvents = receipt.logs
      .filter(log => log.address === arbitrageContract.address)
      .map(log => {
        try {
          return arbitrageContract.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .filter(event => event && event.name === 'Arbitrage');
    
    if (arbitrageEvents.length > 0) {
      const event = arbitrageEvents[0];
      console.log(`Arbitrage executed successfully!`);
      console.log(`Token: ${event.args.tokenBorrow}`);
      console.log(`Amount: ${ethers.formatEther(event.args.amount)} ETH`);
      console.log(`Profit: ${ethers.formatEther(event.args.profit)} ETH`);
    } else {
      console.log("Arbitrage event not found in transaction logs.");
    }
    
  } catch (error) {
    console.error("Error executing arbitrage:", error);
  }
}

// Error handler for unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Start the bot
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = {
  main,
  monitorArbitrageOpportunities,
  calculateArbitrage,
  executeArbitrage
};
