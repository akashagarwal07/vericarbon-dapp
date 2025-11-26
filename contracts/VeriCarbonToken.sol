// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title VeriCarbonToken
 * @dev This is the "Digital Token" contract.
 * It manages the ERC-1155 credits, including the expiry logic.
 * It uses AccessControl to define a MINTER_ROLE. Only the
 * Certification contract will be granted this role.
 */
contract VeriCarbonToken is ERC1155Supply, AccessControl {
    
    // --- State Variables ---

    // The MINTER_ROLE is the only one who can mint new tokens.
    // This role will be granted to the Certification contract.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    mapping(uint256 => string) private _tokenURIs;
    
    // Stores the expiration timestamp for each token ID
    mapping(uint256 => uint256) public expiryTimestamp;

    // --- Events ---
    event CreditsIssued(uint256 indexed tokenId, address indexed to, uint256 amount, string uri, uint256 expiry);
    event CreditsRetired(uint256 indexed tokenId, address indexed from, uint256 amount); // Correct definition

    // --- Constructor ---
    constructor() ERC1155("") { // URI is set per-token
        // The deployer gets Admin and Minter roles initially.
        // The Admin role is used to grant MINTER_ROLE to the Certification contract.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // --- Core Functions ---

    /**
     * @notice Mints new credits.
     * @dev Only callable by an address with MINTER_ROLE.
     * This will be the Certification contract.
     * @param _to The address to receive the new credits.
     * @param _amount The number of credits to mint.
     * @param _uri The IPFS hash for project metadata.
     * @param _durationInDays The number of days until the credits expire.
     */
    function issueCredits(
        address _to,
        uint256 _amount,
        string memory _uri,
        uint256 _durationInDays
    ) public onlyRole(MINTER_ROLE) returns (uint256) {
        _tokenIdCounter.increment();
        uint256 newItemId = _tokenIdCounter.current();

        // Set the expiry timestamp
        uint256 expiry = block.timestamp + (_durationInDays * 1 days);
        expiryTimestamp[newItemId] = expiry;

        // Mint the tokens
        _mint(_to, newItemId, _amount, "");
        _setURI(newItemId, _uri);

        emit CreditsIssued(newItemId, _to, _amount, _uri, expiry);
        return newItemId;
    }

    /**
     * @notice Retires (burns) credits.
     * @dev Any token holder can call this to burn their own credits.
     * The expiry check is handled automatically by _update.
     */
    function retireCredits(uint256 _tokenId, uint256 _amount) public {
        _burn(msg.sender, _tokenId, _amount);
        
        // --- THIS IS THE CORRECTED LINE ---
        emit CreditsRetired(_tokenId, msg.sender, _amount); // Correct order: tokenId, from, amount
    }

    // --- Internal & View Functions ---

    /**
     * @dev Returns the metadata URI for a given token ID.
     */
    function uri(uint256 _tokenId) public view override returns (string memory) {
        require(expiryTimestamp[_tokenId] > 0, "Token ID does not exist");
        return _tokenURIs[_tokenId];
    }

    function _setURI(uint256 _tokenId, string memory _uri) internal {
        _tokenURIs[_tokenId] = _uri;
    }

    /**
     * @dev Hook that is called before any token transfer, including burn and transfer.
     * We add our expiry check here.
     */
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155Supply)
    {
        // This check applies to all transfers, burns, etc.
        // We skip the check on minting (when from == address(0))
        if (from != address(0)) {
            for (uint256 i = 0; i < ids.length; ++i) {
                uint256 expiry = expiryTimestamp[ids[i]];
                require(expiry > 0, "Token ID does not exist");
                require(block.timestamp <= expiry, "Credits have expired");
            }
        }
        
        super._update(from, to, ids, values);
    }

    /**
     * @dev Required by Solidity 0.8+
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}