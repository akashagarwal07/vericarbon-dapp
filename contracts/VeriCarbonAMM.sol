// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// --- Interfaces ---
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC1155 {
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
}

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";

/**
 * @title VeriCarbonMultiAMM
 * @dev UPGRADED: Supports trading ANY Project ID.
 * Creates a separate liquidity pool for each Token ID.
 */
contract VeriCarbonAMM is ERC1155Receiver {
    using SafeMath for uint256;

    IERC1155 public carbonToken;
    IERC20 public stablecoin;

    // Mappings: TokenID => Reserve Amount
    // This replaces the single uint256 variables
    mapping(uint256 => uint256) public carbonReserves;
    mapping(uint256 => uint256) public stablecoinReserves;

    event Swap(address indexed user, uint256 indexed tokenId, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed provider, uint256 indexed tokenId, uint256 carbonAmount, uint256 stablecoinAmount);

    constructor(address _carbonTokenAddress, address _stablecoinAddress) {
        carbonToken = IERC1155(_carbonTokenAddress);
        stablecoin = IERC20(_stablecoinAddress);
    }

    // --- CORE FUNCTIONS (Now accept _tokenId) ---

    function addLiquidity(uint256 _tokenId, uint256 _carbonAmount, uint256 _stablecoinAmount) public {
        carbonToken.safeTransferFrom(msg.sender, address(this), _tokenId, _carbonAmount, "");
        stablecoin.transferFrom(msg.sender, address(this), _stablecoinAmount);

        carbonReserves[_tokenId] = carbonReserves[_tokenId].add(_carbonAmount);
        stablecoinReserves[_tokenId] = stablecoinReserves[_tokenId].add(_stablecoinAmount);
        
        emit LiquidityAdded(msg.sender, _tokenId, _carbonAmount, _stablecoinAmount);
    }

    function swapCarbonForStablecoin(uint256 _tokenId, uint256 _carbonAmountIn) public {
        require(_carbonAmountIn > 0, "Amount must be > 0");
        
        // Look up the specific bucket for this ID
        uint256 reserveCarbon = carbonReserves[_tokenId];
        uint256 reserveStable = stablecoinReserves[_tokenId];
        require(reserveCarbon > 0 && reserveStable > 0, "No liquidity for this Project ID");

        // 1. Pull carbon tokens
        carbonToken.safeTransferFrom(msg.sender, address(this), _tokenId, _carbonAmountIn, "");

        // 2. Calculate Output (x * y = k)
        uint256 newReserveCarbon = reserveCarbon.add(_carbonAmountIn);
        uint256 k = reserveCarbon.mul(reserveStable);
        uint256 newReserveStable = k.div(newReserveCarbon);
        uint256 stablecoinAmountOut = reserveStable.sub(newReserveStable);

        // 3. Update & Transfer
        carbonReserves[_tokenId] = newReserveCarbon;
        stablecoinReserves[_tokenId] = newReserveStable;
        stablecoin.transfer(msg.sender, stablecoinAmountOut);

        emit Swap(msg.sender, _tokenId, _carbonAmountIn, stablecoinAmountOut);
    }

    function swapStablecoinForCarbon(uint256 _tokenId, uint256 _stablecoinAmountIn) public {
        require(_stablecoinAmountIn > 0, "Amount must be > 0");
        
        uint256 reserveCarbon = carbonReserves[_tokenId];
        uint256 reserveStable = stablecoinReserves[_tokenId];
        require(reserveCarbon > 0 && reserveStable > 0, "No liquidity for this Project ID");

        // 1. Pull stablecoin
        stablecoin.transferFrom(msg.sender, address(this), _stablecoinAmountIn);

        // 2. Calculate Output (x * y = k)
        uint256 newReserveStable = reserveStable.add(_stablecoinAmountIn);
        uint256 k = reserveCarbon.mul(reserveStable);
        uint256 newReserveCarbon = k.div(newReserveStable);
        uint256 carbonAmountOut = reserveCarbon.sub(newReserveCarbon);

        // 3. Update & Transfer
        stablecoinReserves[_tokenId] = newReserveStable;
        carbonReserves[_tokenId] = newReserveCarbon;
        
        carbonToken.safeTransferFrom(address(this), msg.sender, _tokenId, carbonAmountOut, "");

        emit Swap(msg.sender, _tokenId, _stablecoinAmountIn, carbonAmountOut);
    }

    // --- REQUIRED OVERRIDES ---
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) public virtual override returns (bytes4) {
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) public virtual override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}