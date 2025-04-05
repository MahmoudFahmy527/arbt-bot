// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@aave/protocol-v2/contracts/flashloan/base/FlashLoanReceiverBase.sol";
import "@aave/protocol-v2/contracts/interfaces/ILendingPoolAddressesProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Uniswap and Sushiswap router interfaces
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

/**
 * @title ArbitrageFlashLoan
 * @dev Flash loan arbitrage contract that leverages Aave flash loans to perform arbitrage between DEXes
 */
contract ArbitrageFlashLoan is FlashLoanReceiverBase, Ownable {
    IUniswapV2Router public immutable uniswapRouter;
    IUniswapV2Router public immutable sushiswapRouter;
    
    event Arbitrage(address tokenBorrow, uint256 amount, uint256 profit);
    
    /**
     * @param _addressProvider The Aave lending pool addresses provider
     * @param _uniswapRouter The Uniswap router address
     * @param _sushiswapRouter The Sushiswap router address
     */
    constructor(
        address _addressProvider, 
        address _uniswapRouter, 
        address _sushiswapRouter
    ) 
        FlashLoanReceiverBase(ILendingPoolAddressesProvider(_addressProvider))
        Ownable(msg.sender)
    {
        uniswapRouter = IUniswapV2Router(_uniswapRouter);
        sushiswapRouter = IUniswapV2Router(_sushiswapRouter);
    }
    
    /**
     * @dev The core function to initiate a flash loan for arbitrage
     * @param tokenBorrow The token to borrow using flash loan
     * @param amount The amount to borrow
     * @param intermediateToken The token to swap to during arbitrage
     */
    function executeArbitrage(
        address tokenBorrow,
        uint256 amount,
        address intermediateToken
    ) external onlyOwner {
        address[] memory assets = new address[](1);
        assets[0] = tokenBorrow;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        
        // 0 = no debt, 1 = stable, 2 = variable
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;
        
        // Encode the arbitrage parameters
        bytes memory params = abi.encode(
            tokenBorrow,
            amount,
            intermediateToken
        );
        
        LENDING_POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            params,
            0
        );
    }
    
    /**
     * @dev This function is called after receiving the flash loaned amount
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(initiator == address(this), "Initiator must be this contract");
        
        // Decode the params
        (address tokenBorrow, uint256 amount, address intermediateToken) = abi.decode(
            params,
            (address, uint256, address)
        );
        
        // Ensure we're working with the expected asset
        require(assets[0] == tokenBorrow, "Token mismatch");
        
        // The amount we need to repay
        uint256 amountToRepay = amounts[0] + premiums[0];
        
        // Approve the token to Uniswap and Sushiswap routers
        IERC20(tokenBorrow).approve(address(uniswapRouter), amount);
        
        // Define the swap path
        address[] memory pathUniToSushi = new address[](3);
        pathUniToSushi[0] = tokenBorrow;
        pathUniToSushi[1] = intermediateToken;
        pathUniToSushi[2] = tokenBorrow;
        
        // Execute the arbitrage
        // 1. Swap on Uniswap: tokenBorrow -> intermediateToken
        uint[] memory amountsFromUni = uniswapRouter.swapExactTokensForTokens(
            amount,
            0, // accept any amount
            pathUniToSushi[0:2],
            address(this),
            block.timestamp + 300
        );
        
        // 2. Approve the intermediate token to Sushiswap
        IERC20(intermediateToken).approve(address(sushiswapRouter), amountsFromUni[1]);
        
        // 3. Swap on Sushiswap: intermediateToken -> tokenBorrow
        uint[] memory amountsFromSushi = sushiswapRouter.swapExactTokensForTokens(
            amountsFromUni[1],
            0, // accept any amount
            pathUniToSushi[1:3],
            address(this),
            block.timestamp + 300
        );
        
        // Check if arbitrage was profitable
        uint256 profit = amountsFromSushi[1] > amountToRepay ? 
            amountsFromSushi[1] - amountToRepay : 0;
        
        // Approve the borrowed token for repayment
        IERC20(tokenBorrow).approve(address(LENDING_POOL), amountToRepay);
        
        // Emit arbitrage event
        emit Arbitrage(tokenBorrow, amount, profit);
        
        return true;
    }
    
    /**
     * @dev Withdraw tokens from the contract
     * @param token The token to withdraw
     */
    function withdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner(), balance);
    }
    
    /**
     * @dev Withdraw ETH from the contract
     */
    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Required for receiving ETH
     */
    receive() external payable {}
}