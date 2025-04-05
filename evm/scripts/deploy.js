const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying ArbitrageFlashLoan contract...");

  // Config based on network
  const configs = {
    // Ethereum Mainnet
    mainnet: {
      aaveProvider: "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5", // Mainnet
      uniswapRouter: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
      sushiswapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap Router
    },
    // Polygon Mainnet
    polygon: {
      aaveProvider: "0xd05e3E715d945B59290df0ae8eF85c1BdB684744", // Polygon
      uniswapRouter: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap Router
      sushiswapRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // SushiSwap Router on Polygon
    },
    // For tests
    hardhat: {
      aaveProvider: "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5", // Using Mainnet fork
      uniswapRouter: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      sushiswapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    },
  };

  // Get current network
  const networkName = network.name;
  const config = configs[networkName] || configs.hardhat;

  console.log(`Using config for network: ${networkName}`);
  console.log(`- Aave Provider: ${config.aaveProvider}`);
  console.log(`- Uniswap Router: ${config.uniswapRouter}`);
  console.log(`- Sushiswap Router: ${config.sushiswapRouter}`);

  // Get the ContractFactory and signers
  const ArbitrageFlashLoan = await ethers.getContractFactory("ArbitrageFlashLoan");
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying with account: ${deployer.address}`);

  // Deploy the contract
  const arbitrageContract = await ArbitrageFlashLoan.deploy(
    config.aaveProvider,
    config.uniswapRouter,
    config.sushiswapRouter
  );

  await arbitrageContract.waitForDeployment();

  console.log(`ArbitrageFlashLoan deployed to: ${arbitrageContract.address}`);
  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
