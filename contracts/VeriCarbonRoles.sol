// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VeriCarbonRoles
 * @dev CORRECTED version 3.
 * Fixes a critical bug where 'verifierCount' could be
 * incremented multiple times for the same address.
 */
contract VeriCarbonRoles is AccessControl {

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    uint256 public verifierCount;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // --- Issuer Functions (Upgraded with require) ---
    function addIssuer(address _issuerAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // --- BUG FIX ---
        require(!hasRole(ISSUER_ROLE, _issuerAddress), "Address is already an issuer");
        grantRole(ISSUER_ROLE, _issuerAddress);
    }

    function removeIssuer(address _issuerAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // --- BUG FIX ---
        require(hasRole(ISSUER_ROLE, _issuerAddress), "Address is not an issuer");
        revokeRole(ISSUER_ROLE, _issuerAddress);
    }

    // --- Verifier Functions (Upgraded with require) ---
    function addVerifier(address _verifierAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // --- BUG FIX ---
        require(!hasRole(VERIFIER_ROLE, _verifierAddress), "Address is already a verifier");
        grantRole(VERIFIER_ROLE, _verifierAddress);
        verifierCount++;
    }

    function removeVerifier(address _verifierAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // --- BUG FIX ---
        require(hasRole(VERIFIER_ROLE, _verifierAddress), "Address is not a verifier");
        revokeRole(VERIFIER_ROLE, _verifierAddress);
        verifierCount--;
    }

    // --- View Functions ---
    function isIssuer(address _account) public view returns (bool) {
        return hasRole(ISSUER_ROLE, _account);
    }

    function isVerifier(address _account) public view returns (bool) {
        return hasRole(VERIFIER_ROLE, _account);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}