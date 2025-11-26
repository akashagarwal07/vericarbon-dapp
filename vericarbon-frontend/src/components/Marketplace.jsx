import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { 
    TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI,
    AMM_CONTRACT_ADDRESS, AMM_CONTRACT_ABI 
} from '../config';
import { Container, Row, Col, Card, Form, Button, Nav, Badge, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { FaChartLine, FaWallet, FaExchangeAlt, FaPaperPlane, FaWater, FaFire, FaCoins } from 'react-icons/fa';

// Minimal Standard ERC20 ABI for USDC
const USDC_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)"
];
// Sepolia USDC Address
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; 

const Marketplace = () => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState('trade'); // 'trade', 'transfer', 'pool', 'retire'
    const [tradeMode, setTradeMode] = useState('buy'); // 'buy', 'sell'
    
    const [selectedTokenId, setSelectedTokenId] = useState(null);
    const [inputs, setInputs] = useState({ amount: '', recipient: '', poolVcc: '', poolUsdc: '' });
    const [status, setStatus] = useState('');
    const [loadingAction, setLoadingAction] = useState(false);
    
    // Data State
    const [usdcBalance, setUsdcBalance] = useState('0');
    const [portfolio, setPortfolio] = useState([]); 
    const [marketData, setMarketData] = useState({ price: '0', hasLiquidity: false });
    const [hasCredits, setHasCredits] = useState(false); // New state for welcome message

    const getProviderAndSigner = async () => {
        if (!window.ethereum) return null;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        return { provider, signer };
    };

    // ==================================================================================
    // 1. FETCH PORTFOLIO (Runs ONCE on mount)
    // ==================================================================================
    const loadPortfolio = async () => {
        try {
            const { provider, signer } = await getProviderAndSigner();
            const userAddress = await signer.getAddress();

            const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

            // A. Get USDC Balance
            const usdcBal = await usdcContract.balanceOf(userAddress);
            setUsdcBalance(ethers.formatUnits(usdcBal, 6));

            // B. Get All Token IDs ever minted (via Logs)
            const filter = tokenContract.filters.CreditsIssued();
            const events = await tokenContract.queryFilter(filter);
            
            // FIX: Convert BigInt to String before Set to ensure uniqueness
            const allTokenIds = [...new Set(events.map(e => e.args.tokenId.toString()))];

            if (allTokenIds.length > 0) {
                // Check balances for all IDs
                const owners = Array(allTokenIds.length).fill(userAddress);
                const balances = await tokenContract.balanceOfBatch(owners, allTokenIds);

                const myTokens = [];
                let totalCredits = 0;

                for (let i = 0; i < allTokenIds.length; i++) {
                    const bal = balances[i];
                    // Show token if I own it OR if I created it (optional, but good for testing)
                    if (bal > 0n) {
                        const id = allTokenIds[i];
                        const expiry = await tokenContract.expiryTimestamp(id);
                        const uri = await tokenContract.uri(id);
                        
                        const expiryDate = new Date(Number(expiry) * 1000);
                        const isExpired = Date.now() > expiryDate.getTime();

                        myTokens.push({
                            id: id,
                            balance: bal.toString(),
                            uri: uri,
                            expiryDate: expiryDate.toLocaleDateString(),
                            isExpired: isExpired
                        });
                        totalCredits += Number(bal);
                    }
                }
                setPortfolio(myTokens);
                setHasCredits(totalCredits > 0);
                
                // Auto-select first token if none selected
                if (myTokens.length > 0 && !selectedTokenId) {
                    setSelectedTokenId(myTokens[0].id);
                }
            } else {
                setHasCredits(false);
            }
        } catch (error) {
            console.error("Portfolio Load Error:", error);
        }
    };

    // ==================================================================================
    // 2. FETCH MARKET DATA (Runs when Token ID changes)
    // ==================================================================================
    const loadMarketData = useCallback(async () => {
        if (!selectedTokenId) return;
        
        try {
            const { provider } = await getProviderAndSigner();
            const ammContract = new ethers.Contract(AMM_CONTRACT_ADDRESS, AMM_CONTRACT_ABI, provider);

            // Fetch Reserves for SPECIFIC Token ID
            const resCarbon = await ammContract.carbonReserves(selectedTokenId);
            const resStable = await ammContract.stablecoinReserves(selectedTokenId);
            
            const carbonNum = Number(resCarbon);
            const stableNum = Number(resStable);

            if (carbonNum > 0 && stableNum > 0) {
                // Price = USDC / Carbon
                // USDC has 6 decimals, so divide by 1e6 to get "Real Dollars"
                const priceRaw = (stableNum / 1e6) / carbonNum;
                setMarketData({ 
                    price: priceRaw.toFixed(4), 
                    hasLiquidity: true 
                });
            } else {
                setMarketData({ price: '0', hasLiquidity: false });
            }

        } catch (error) {
            console.error("Market Data Error:", error);
            setMarketData({ price: '0', hasLiquidity: false });
        }
    }, [selectedTokenId]); // Only re-create this function if ID changes

    // --- EFFECTS ---
    useEffect(() => { loadPortfolio(); }, []); // Run once on mount
    useEffect(() => { loadMarketData(); }, [loadMarketData]); // Run when ID changes


    // ==================================================================================
    // 3. ACTIONS
    // ==================================================================================
    const handleTrade = async () => {
        if (!inputs.amount || !selectedTokenId) return;
        if (!marketData.hasLiquidity) return alert("No liquidity pool exists for this Project ID yet.");

        try {
            setLoadingAction(true);
            setStatus('Trading... Check MetaMask.');
            const { signer } = await getProviderAndSigner();
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
            const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, signer);
            const ammContract = new ethers.Contract(AMM_CONTRACT_ADDRESS, AMM_CONTRACT_ABI, signer);

            if (tradeMode === 'buy') {
                const amountInWei = ethers.parseUnits(inputs.amount, 6); 
                const txApp = await usdcContract.approve(AMM_CONTRACT_ADDRESS, amountInWei);
                await txApp.wait();
                const txSwap = await ammContract.swapStablecoinForCarbon(selectedTokenId, amountInWei);
                await txSwap.wait();
            } else {
                const txApp = await tokenContract.setApprovalForAll(AMM_CONTRACT_ADDRESS, true);
                await txApp.wait();
                const txSwap = await ammContract.swapCarbonForStablecoin(selectedTokenId, inputs.amount);
                await txSwap.wait();
            }
            setStatus('Success! Trade executed.');
            setInputs({ ...inputs, amount: '' });
            loadPortfolio(); // Refresh balances
            loadMarketData(); // Refresh price (slippage)
        } catch (err) { console.error(err); setStatus("Error: " + err.message); }
        finally { setLoadingAction(false); }
    };

    const handleAddLiquidity = async () => {
        if (!inputs.poolVcc || !inputs.poolUsdc || !selectedTokenId) return alert("Fill all fields");
        try {
            setLoadingAction(true);
            setStatus('Adding Liquidity... Step 1/3: Approve VCC');
            const { signer } = await getProviderAndSigner();
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
            const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, signer);
            const ammContract = new ethers.Contract(AMM_CONTRACT_ADDRESS, AMM_CONTRACT_ABI, signer);

            const txApp1 = await tokenContract.setApprovalForAll(AMM_CONTRACT_ADDRESS, true);
            await txApp1.wait();

            setStatus('Step 2/3: Approve USDC');
            const usdcWei = ethers.parseUnits(inputs.poolUsdc, 6);
            const txApp2 = await usdcContract.approve(AMM_CONTRACT_ADDRESS, usdcWei);
            await txApp2.wait();

            setStatus('Step 3/3: Adding to Pool...');
            const txAdd = await ammContract.addLiquidity(selectedTokenId, inputs.poolVcc, usdcWei);
            await txAdd.wait();

            setStatus('Success! Liquidity Pool Updated.');
            loadMarketData(); // Refresh pool status
        } catch (err) { console.error(err); setStatus("Error: " + err.message); }
        finally { setLoadingAction(false); }
    };

    const handleTransfer = async () => {
        if (!inputs.amount || !inputs.recipient) return alert("Fill fields");
        try {
            setLoadingAction(true);
            setStatus('Transferring...');
            const { signer } = await getProviderAndSigner();
            const userAddress = await signer.getAddress();
            const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, signer);
            const tx = await tokenContract.safeTransferFrom(userAddress, inputs.recipient, selectedTokenId, inputs.amount, "0x");
            await tx.wait();
            setStatus(`Success! Sent.`);
            loadPortfolio();
        } catch (err) { console.error(err); setStatus("Error: " + err.message); }
        finally { setLoadingAction(false); }
    };

    const handleRetire = async () => {
        if (!inputs.amount) return;
        try {
            setLoadingAction(true);
            setStatus('Retiring...');
            const { signer } = await getProviderAndSigner();
            const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, signer);
            const tx = await tokenContract.retireCredits(selectedTokenId, inputs.amount);
            await tx.wait();
            setStatus('Success! Retired.');
            loadPortfolio();
        } catch (err) { console.error(err); setStatus("Error: " + err.message); }
        finally { setLoadingAction(false); }
    };

    return (
        <Container>
            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-0"><FaChartLine className="me-2 text-primary" /> Marketplace</h2>
                    <small className="text-muted">Trading Pair: <Badge bg="secondary">VCC#{selectedTokenId || '?'}</Badge> / USDC</small>
                </div>
                <div className="text-end">
                    <small className="text-muted fw-bold"><FaWallet className="me-1" /> YOUR WALLET</small>
                    <h3 className="mb-0">${usdcBalance} <span className="fs-6 text-muted">USDC</span></h3>
                </div>
            </div>

            {/* PORTFOLIO CAROUSEL */}
            <h6 className="text-muted text-uppercase mb-3">Your Assets</h6>
            
            {!hasCredits && (
                <Alert variant="info" className="text-center py-4 mb-4">
                    <Alert.Heading>👋 Welcome to VeriCarbon!</Alert.Heading>
                    <p>
                        It looks like you don't have any carbon credits yet. 
                        You can create liquidity pools or buy credits below to get started!
                    </p>
                </Alert>
            )}

            {hasCredits && (
                <div className="d-flex gap-3 overflow-auto pb-3 mb-4">
                    {portfolio.map(token => (
                        <Card 
                            key={token.id} 
                            onClick={() => setSelectedTokenId(token.id)}
                            className={`flex-shrink-0 ${selectedTokenId === token.id ? 'border-primary bg-light' : ''}`}
                            style={{minWidth: '220px', cursor: 'pointer'}}
                        >
                            <Card.Body>
                                <div className="d-flex justify-content-between mb-2">
                                    <Badge bg="secondary">#{token.id}</Badge>
                                    <Badge bg={token.isExpired ? 'danger' : 'success'}>{token.isExpired ? 'EXPIRED' : 'ACTIVE'}</Badge>
                                </div>
                                <h2 className="mb-0">{token.balance}</h2>
                                <small className="text-muted">Expires: {token.expiryDate}</small>
                            </Card.Body>
                        </Card>
                    ))}
                </div>
            )}

            {/* ACTION CENTER */}
            <Card className="shadow-sm">
                <Card.Header>
                    <Nav variant="tabs" defaultActiveKey="trade" onSelect={(k) => setActiveTab(k)}>
                        <Nav.Item><Nav.Link eventKey="trade"><FaExchangeAlt className="me-1" /> Trade</Nav.Link></Nav.Item>
                        <Nav.Item><Nav.Link eventKey="transfer"><FaPaperPlane className="me-1" /> Transfer</Nav.Link></Nav.Item>
                        <Nav.Item><Nav.Link eventKey="pool"><FaWater className="me-1" /> Liquidity</Nav.Link></Nav.Item>
                        <Nav.Item><Nav.Link eventKey="retire"><FaFire className="me-1" /> Retire</Nav.Link></Nav.Item>
                    </Nav>
                </Card.Header>
                <Card.Body className="p-4">
                    
                    {status && <Alert variant="info" onClose={() => setStatus('')} dismissible>{status}</Alert>}

                    {/* TRADE TAB */}
                    {activeTab === 'trade' && (
                        <div style={{maxWidth: '500px', margin: '0 auto'}}>
                            {!marketData.hasLiquidity && <Alert variant="warning">No Liquidity Pool found for Project #{selectedTokenId}. Add liquidity first.</Alert>}
                            
                            <div className="d-flex justify-content-center mb-4">
                                <div className="btn-group">
                                    <Button variant={tradeMode === 'buy' ? 'primary' : 'outline-primary'} onClick={() => setTradeMode('buy')}>Buy</Button>
                                    <Button variant={tradeMode === 'sell' ? 'warning' : 'outline-warning'} onClick={() => setTradeMode('sell')}>Sell</Button>
                                </div>
                            </div>

                            <p className="text-center text-muted mb-4">
                                Price: 1 VCC ≈ <strong>${marketData.price} USDC</strong>
                            </p>

                            <Form.Group className="mb-3">
                                <Form.Label>{tradeMode === 'buy' ? "USDC Amount" : "VCC Amount"}</Form.Label>
                                <Form.Control type="number" size="lg" value={inputs.amount} onChange={e => setInputs({...inputs, amount: e.target.value})} />
                            </Form.Group>

                            <Button size="lg" className="w-100" variant={tradeMode === 'buy' ? 'primary' : 'warning'} onClick={handleTrade} disabled={!marketData.hasLiquidity || loadingAction}>
                                {loadingAction ? <Spinner size="sm" animation="border" /> : (
                                    <><FaExchangeAlt className="me-2" /> {tradeMode === 'buy' ? 'Swap USDC → VCC' : 'Swap VCC → USDC'}</>
                                )}
                            </Button>
                        </div>
                    )}

                    {/* TRANSFER TAB */}
                    {activeTab === 'transfer' && (
                        <div style={{maxWidth: '500px', margin: '0 auto'}}>
                            <Form.Group className="mb-3">
                                <Form.Label>Recipient Address</Form.Label>
                                <Form.Control type="text" placeholder="0x..." value={inputs.recipient} onChange={e => setInputs({...inputs, recipient: e.target.value})} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Amount</Form.Label>
                                <Form.Control type="number" value={inputs.amount} onChange={e => setInputs({...inputs, amount: e.target.value})} />
                            </Form.Group>
                            <Button className="w-100" variant="primary" onClick={handleTransfer} disabled={loadingAction}>
                                {loadingAction ? <Spinner size="sm" animation="border" /> : <><FaPaperPlane className="me-2" /> Send Tokens</>}
                            </Button>
                        </div>
                    )}

                    {/* POOL TAB */}
                    {activeTab === 'pool' && (
                        <div style={{maxWidth: '600px', margin: '0 auto'}}>
                            <Alert variant="secondary">
                                Add liquidity to enable trading for <strong>Project #{selectedTokenId || '?'}</strong>. You earn fees on every trade.
                            </Alert>
                            <Row>
                                <Col>
                                    <Form.Group className="mb-3">
                                        <Form.Label>VCC Amount</Form.Label>
                                        <Form.Control type="number" value={inputs.poolVcc} onChange={e => setInputs({...inputs, poolVcc: e.target.value})} />
                                    </Form.Group>
                                </Col>
                                <Col>
                                    <Form.Group className="mb-3">
                                        <Form.Label>USDC Amount</Form.Label>
                                        <Form.Control type="number" value={inputs.poolUsdc} onChange={e => setInputs({...inputs, poolUsdc: e.target.value})} />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Button className="w-100" variant="warning" onClick={handleAddLiquidity} disabled={loadingAction}>
                                {loadingAction ? <Spinner size="sm" animation="border" /> : <><FaWater className="me-2" /> Add Liquidity</>}
                            </Button>
                        </div>
                    )}

                    {/* RETIRE TAB */}
                    {activeTab === 'retire' && (
                        <div style={{maxWidth: '500px', margin: '0 auto', textAlign: 'center'}}>
                            <div className="display-1 mb-3 text-success"><FaFire /></div>
                            <h3>Offset Your Carbon</h3>
                            <p className="text-muted mb-4">Retiring tokens permanently removes them from circulation.</p>
                            
                            <Form.Group className="mb-3">
                                <Form.Control type="number" size="lg" placeholder="Amount to Burn" className="text-center" value={inputs.amount} onChange={e => setInputs({...inputs, amount: e.target.value})} />
                            </Form.Group>
                            
                            <Button size="lg" className="w-100" variant="success" onClick={handleRetire} disabled={loadingAction}>
                                {loadingAction ? <Spinner size="sm" animation="border" /> : 'Confirm Retirement'}
                            </Button>
                        </div>
                    )}

                </Card.Body>
            </Card>
        </Container>
    );
};

export default Marketplace;