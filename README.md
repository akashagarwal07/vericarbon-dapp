# VeriCarbon: Blockchain-Based Carbon Credit Ecosystem

**VeriCarbon** is a decentralized application (DApp) designed to enhance the integrity and efficiency of global carbon credit markets. By leveraging blockchain technology, it addresses critical issues in traditional markets such as centralization, double-spending, lack of transparency, and credit hoarding.

This project synthesizes research from **Patel et al. (2020)** regarding token expiry mechanics and **Kalaiselvan et al. (2024)** regarding multi-contract architecture.

-----

## Key Features

  * **Role-Based Access Control:** Distinct dashboards for Admins, Issuers, Verifiers, and Companies.
  * **Dynamic 51% Consensus:** A robust verification system where projects are only minted after achieving majority approval from registered verifiers.
  * **Anti-Hoarding Mechanism:** Carbon credits (ERC-1155) are issued with an on-chain **expiry timestamp**. Expired credits cannot be traded or retired.
  * **Multi-Pool AMM (Automated Market Maker):** A decentralized exchange allowing companies to trade specific project credits against stablecoins (USDC) instantly.
  * **IPFS Integration:** Project documentation is uploaded to IPFS (via Pinata) for immutable, transparent verification.
  * **Full Lifecycle Tracking:** From issuance proposal -\> verification -\> minting -\> trading -\> retirement (burning).

-----

## System Architecture

The backend consists of four interacting Smart Contracts deployed on the **Sepolia Testnet**:

1.  **`VeriCarbonRoles.sol` (The Registry):**
      * Manages permissions.
      * Stores the list of authorized Issuers and Verifiers.
      * Allows Companies to self-register.
2.  **`VeriCarbonToken.sol` (The Asset):**
      * An **ERC-1155** contract representing the Carbon Credits.
      * Implements the **Expiry Logic** (checks timestamps on transfer).
      * Only the *Certification Contract* has the authority to mint.
3.  **`Certification.sol` (The Consensus Engine):**
      * Handles project proposals and the voting process.
      * Calculates the 51% consensus threshold dynamically based on the active verifier count.
      * Triggers the minting process once consensus is reached.
4.  **`VeriCarbonAMM.sol` (The Marketplace):**
      * A multi-asset liquidity pool.
      * Supports trading for *any* verified Project ID created by the system.
      * Uses the Constant Product Formula ($x * y = k$) for pricing.

-----

##  Tech Stack

  * **Blockchain:** Ethereum (Sepolia Testnet)
  * **Smart Contracts:** Solidity (v0.8.20)
  * **Framework:** Remix IDE
  * **Libraries:** OpenZeppelin (AccessControl, ERC1155, ERC20)
  * **Frontend:** React.js (Vite)
  * **Web3 Client:** Ethers.js (v6)
  * **Storage:** IPFS (Pinata)
  * **Routing:** React Router DOM

-----

##  Installation & Setup

### 1\. Clone the Repository

```bash
git clone https://github.com/akashagarwal07/VeriCarbon.git
cd VeriCarbon
```

### 2\. Smart Contract Deployment (Backend)

*Note: These contracts (in /contracts folder) must be deployed in a specific order.*

1.  **Deploy `VeriCarbonRoles.sol`**:
      * Copy the address (e.g., `ROLES_ADDR`).
2.  **Deploy `VeriCarbonToken.sol`**:
      * Copy the address (e.g., `TOKEN_ADDR`).
3.  **Deploy `Certification.sol`**:
      * Constructor Args: `[ROLES_ADDR, TOKEN_ADDR]`
      * Copy the address (e.g., `CERT_ADDR`).
4.  **Link Contracts (CRITICAL):**
      * Go to `VeriCarbonToken`. Call `grantRole(MINTER_ROLE, CERT_ADDR)`.
      * *This authorizes the Certification contract to mint tokens.*
5.  **Deploy `VeriCarbonAMM.sol`**:
      * Constructor Args: `[TOKEN_ADDR, USDC_ADDRESS]`
      * *(Use Sepolia USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`)*.

### 3\. Frontend Setup

Navigate to the frontend directory:

```bash
cd vericarbon-frontend
npm install
```

### 4\. Environment Configuration

Create a `.env` file in the `vericarbon-frontend` root to enable file uploads (Pinata setup required):

```env
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_API_SECRET=your_pinata_secret_key
```

Update `src/config.js` with your deployed contract addresses and ABIs:

```javascript
export const ROLES_CONTRACT_ADDRESS = "0x...";
export const TOKEN_CONTRACT_ADDRESS = "0x...";
// ... update all 4 addresses and paste the ABIs from Remix
```

### 5\. Run the DApp

```bash
npm run dev
```

Access the application at `http://localhost:5173`.

-----

## User Guide & Workflow

### 1\. Administrator 

  * **Login:** Connect wallet with the `DEFAULT_ADMIN_ROLE` (Deployer).
  * **Actions:**
      * Go to **Admin Panel**.
      * **User Governance:** Add or Remove Issuers and Verifiers.
      * **Token Registry:** View a master list of all tokens ever minted.
      * **Token Inspector:** Check the live supply and expiry status of any Token ID.

### 2\. Issuer (Project Creator)

  * **Prerequisite:** Must be added by Admin.
  * **Actions:**
      * Go to **Issuer Dashboard**.
      * Fill out the **New Proposal** form (Receiver Company, Amount, Duration).
      * **Upload Document:** Attach PDF/Image proof. The system uploads this to **IPFS**.
      * Submit Proposal to the blockchain.
      * Track the status of proposals (Pending/Minted) in the history view.

### 3\. Verifier (Auditor)

  * **Prerequisite:** Must be added by Admin.
  * **Actions:**
      * Go to **Verifier Dashboard**.
      * View the **"Needs Review"** tab for pending projects.
      * **Audit:** Click "View IPFS Doc" to inspect the project files.
      * **Vote:** Click "Add Signature".
      * **Mint:** Once 51% consensus is reached, the "Execute Mint" button appears. Clicking this mints the tokens to the Company.

### 4\. Company (Trader/End User)

  * **Registration:** Connect a fresh wallet. The system detects no role and prompts **"Register as Company"**.
  * **Marketplace Actions:**
      * **Portfolio:** View holdings of all Project Credits and check if they are Active or Expired.
      * **Liquidity:** Add VCC + USDC to a pool to enable trading for a specific project.
      * **Trade:** Swap USDC for Carbon Credits (Buy) or Credits for USDC (Sell).
      * **Retire:** Burn credits to offset carbon footprint. This permanently removes them from circulation.
      * **Transfer:** Send credits peer-to-peer to other wallets.

-----

## Testing

**Manual E2E Test:**

1.  **Admin** adds Issuer A and Verifiers B, C, D.
2.  **Issuer A** proposes a project for Company X (1000 Credits).
3.  **Verifier B** votes (33% - Pending).
4.  **Verifier C** votes (66% - Consensus Reached).
5.  **Verifier C** executes mint.
6.  **Company X** sees 1000 Credits in Marketplace.
7.  **Company X** adds 100 Credits + 100 USDC to Liquidity Pool.
8.  **Company Y** buys 10 Credits using USDC via the AMM.

-----

##  License

This project is for educational and research purposes.

**Authors:**

  * Akash Agarwal
