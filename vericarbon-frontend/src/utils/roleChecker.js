// src/utils/roleChecker.js
import { ethers } from 'ethers';
import { ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI } from '../config';

export const checkUserRole = async (userAddress, provider) => {
    try {
        // DEFAULT_ADMIN_ROLE is always this specific hash
        const ADMIN_ROLE_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

        // Check if address/ABI are valid before crashing
        if (!ROLES_CONTRACT_ADDRESS || !ROLES_CONTRACT_ABI) {
            console.error("Missing Contract Address or ABI in config.js");
            return 'error';
        }

        const contract = new ethers.Contract(ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI, provider);

        // 1. Check Admin
        const isAdmin = await contract.hasRole(ADMIN_ROLE_HASH, userAddress);
        if (isAdmin) return 'admin';

        // 2. Check Issuer
        const isIssuer = await contract.isIssuer(userAddress);
        if (isIssuer) return 'issuer';

        // 3. Check Verifier
        const isVerifier = await contract.isVerifier(userAddress);
        if (isVerifier) return 'verifier';

        return 'company';

    } catch (error) {
        console.error("Failed to check role:", error);
        return 'error';
    }
};