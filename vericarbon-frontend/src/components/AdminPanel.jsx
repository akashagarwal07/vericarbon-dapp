import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
    ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI,
    TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI 
} from '../config';
import { Container, Row, Col, Card, Form, Button, Table, Tab, Tabs, Alert, Badge, Spinner, InputGroup } from 'react-bootstrap';
import { FaShieldAlt, FaUsers, FaBoxOpen, FaExclamationTriangle, FaSync, FaSearch, FaUserPlus, FaUserMinus, FaTrash } from 'react-icons/fa';

const AdminPanel = () => {
    // --- STATE: Users ---
    const [issuers, setIssuers] = useState([]);
    const [verifiers, setVerifiers] = useState([]);
    
    // --- STATE: Tokens ---
    const [allTokens, setAllTokens] = useState([]);
    const [tokenInspectorData, setTokenInspectorData] = useState(null);

    // --- STATE: UI ---
    const [key, setKey] = useState('users');
    const [userSubTab, setUserSubTab] = useState('issuer'); // 'issuer', 'verifier'
    
    const [inputAddress, setInputAddress] = useState('');
    const [inputTokenId, setInputTokenId] = useState('');
    
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    // Role Constants
    const ROLES = {
        issuer: ethers.id("ISSUER_ROLE"),
        verifier: ethers.id("VERIFIER_ROLE")
    };

    const getProviderAndSigner = async () => {
        if (!window.ethereum) return null;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        return { provider, signer };
    };

    // ==================================================================================
    // 1. FETCH DATA (Users & Tokens)
    // ==================================================================================
    const refreshAllData = async () => {
        try {
            setLoading(true);
            const { provider } = await getProviderAndSigner();
            const rolesContract = new ethers.Contract(ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI, provider);
            const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);

            // --- A. FETCH USERS (Issuers & Verifiers Only) ---
            const getUsers = async (roleHash) => {
                const filter = rolesContract.filters.RoleGranted(roleHash);
                const events = await rolesContract.queryFilter(filter);
                const uniqueAddrs = [...new Set(events.map(e => e.args.account))];
                
                const active = [];
                for (let addr of uniqueAddrs) {
                    if (await rolesContract.hasRole(roleHash, addr)) active.push(addr);
                }
                return active;
            };

            const [iList, vList] = await Promise.all([
                getUsers(ROLES.issuer),
                getUsers(ROLES.verifier)
            ]);

            setIssuers(iList);
            setVerifiers(vList);

            // --- B. FETCH ALL TOKENS ---
            const creditFilter = tokenContract.filters.CreditsIssued();
            const creditEvents = await tokenContract.queryFilter(creditFilter);

            const formattedTokens = creditEvents.map(e => ({
                id: e.args[0].toString(),
                owner: e.args[1],
                amount: e.args[2].toString(),
                uri: e.args[3],
                expiry: new Date(Number(e.args[4]) * 1000).toLocaleDateString()
            }));

            setAllTokens(formattedTokens.reverse());
            setLoading(false);

        } catch (error) {
            console.error("Admin Load Error:", error);
            setStatus("Error loading data. Check console.");
            setLoading(false);
        }
    };

    useEffect(() => { refreshAllData(); }, []);


    // ==================================================================================
    // 2. USER ACTIONS
    // ==================================================================================
    const handleUserAction = async (type) => {
        if (!inputAddress) return alert("Enter an address");
        try {
            setStatus(`Processing ${type}... Check MetaMask.`);
            const { signer } = await getProviderAndSigner();
            const contract = new ethers.Contract(ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI, signer);
            let tx;

            if (userSubTab === 'issuer') {
                tx = type === 'add' ? await contract.addIssuer(inputAddress) : await contract.removeIssuer(inputAddress);
            } else if (userSubTab === 'verifier') {
                tx = type === 'add' ? await contract.addVerifier(inputAddress) : await contract.removeVerifier(inputAddress);
            }

            await tx.wait();
            setStatus("Success! List updated.");
            setInputAddress('');
            refreshAllData();
        } catch (err) {
            console.error(err);
            setStatus("Error: " + (err.reason || err.message));
        }
    };


    // ==================================================================================
    // 3. TOKEN INSPECTOR (FIXED & RESTORED)
    // ==================================================================================
    const inspectToken = async () => {
        if (!inputTokenId) return;
        try {
            setTokenInspectorData(null); // Clear previous data
            setStatus(`Inspecting Token #${inputTokenId}...`);
            const { provider } = await getProviderAndSigner();
            const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);

            // 1. Check Expiry First (Safest check to see if token exists)
            const expiry = await contract.expiryTimestamp(inputTokenId);

            if (Number(expiry) === 0) {
                setStatus(`❌ Token ID #${inputTokenId} does not exist.`);
                return;
            }

            // 2. Fetch URI and Supply
            // FIX: We use specific syntax for totalSupply because it is overloaded
            const [uri, supply] = await Promise.all([
                contract.uri(inputTokenId),
                contract["totalSupply(uint256)"](inputTokenId) 
            ]);

            setTokenInspectorData({
                id: inputTokenId,
                uri: uri,
                supply: supply.toString(),
                expiryRaw: expiry.toString(),
                expiryDate: new Date(Number(expiry) * 1000).toLocaleString(),
                isExpired: Date.now() > Number(expiry) * 1000
            });
            setStatus("Data fetched successfully.");

        } catch (err) {
            console.error(err);
            setTokenInspectorData(null);
            setStatus("Error: Network issue or invalid input.");
        }
    };

    // ==================================================================================
    // 4. DANGER ZONE
    // ==================================================================================
    const handleRenounceAdmin = async () => {
        if (!window.confirm("⚠️ IRREVERSIBLE: Are you sure you want to renounce Admin rights?")) return;
        try {
            setStatus("Renouncing... Check MetaMask.");
            const { signer } = await getProviderAndSigner();
            const contract = new ethers.Contract(ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI, signer);
            
            // Renounce default admin role (0x00...00)
            const tx = await contract.renounceRole(ethers.ZeroHash, await signer.getAddress());
            await tx.wait();
            alert("Admin Role Renounced. You have lost control.");
            window.location.reload();
        } catch (err) {
            console.error(err);
            setStatus("Error: " + err.message);
        }
    };

    return (
        <Container>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-dark"><FaShieldAlt className="me-2 text-primary" /> Admin Dashboard</h2>
                <Button variant="link" onClick={refreshAllData} disabled={loading}>
                    {loading ? <Spinner size="sm" animation="border" /> : <><FaSync className="me-1"/> Force Refresh</>}
                </Button>
            </div>

            {status && <Alert variant="info" onClose={() => setStatus('')} dismissible>{status}</Alert>}

            <Tabs activeKey={key} onSelect={(k) => setKey(k)} className="mb-4">
                
                {/* --- TAB 1: USER GOVERNANCE --- */}
                <Tab eventKey="users" title={<><FaUsers className="me-1"/> User Governance</>}>
                    <Row>
                        <Col md={12}>
                            <Card className="shadow-sm mb-4">
                                <Card.Body>
                                    <Card.Title>Manage Roles</Card.Title>
                                    <div className="d-flex gap-3 mb-3">
                                        <Form.Check 
                                            type="radio" label="Issuer" name="roleParams" 
                                            checked={userSubTab === 'issuer'} onChange={() => setUserSubTab('issuer')} 
                                        />
                                        <Form.Check 
                                            type="radio" label="Verifier" name="roleParams" 
                                            checked={userSubTab === 'verifier'} onChange={() => setUserSubTab('verifier')} 
                                        />
                                    </div>
                                    <InputGroup className="mb-3">
                                        <Form.Control 
                                            placeholder={`Enter ${userSubTab} Address (0x...)`}
                                            value={inputAddress}
                                            onChange={(e) => setInputAddress(e.target.value)}
                                        />
                                        <Button variant="success" onClick={() => handleUserAction('add')}>
                                            <FaUserPlus className="me-1" /> Add
                                        </Button>
                                        <Button variant="danger" onClick={() => handleUserAction('remove')}>
                                            <FaUserMinus className="me-1" /> Remove
                                        </Button>
                                    </InputGroup>
                                </Card.Body>
                            </Card>

                            <Card className="shadow-sm">
                                <Card.Header className="bg-white fw-bold">Active {userSubTab.toUpperCase()} List</Card.Header>
                                <Table hover responsive className="mb-0">
                                    <tbody>
                                        {(userSubTab === 'issuer' ? issuers : verifiers).map(addr => (
                                            <tr key={addr}>
                                                <td className="font-monospace">{addr}</td>
                                                <td className="text-end">
                                                    <Badge bg="success">ACTIVE</Badge>
                                                    <Button variant="light" size="sm" className="ms-2 text-danger" onClick={() => {setInputAddress(addr); handleUserAction('remove');}}>
                                                        <FaTrash />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {((userSubTab === 'issuer' ? issuers : verifiers).length === 0) && (
                                            <tr><td colSpan="2" className="text-center text-muted">No users found.</td></tr>
                                        )}
                                    </tbody>
                                </Table>
                            </Card>
                        </Col>
                    </Row>
                </Tab>

                {/* --- TAB 2: TOKEN REGISTRY --- */}
                <Tab eventKey="tokens" title={<><FaBoxOpen className="me-1"/> Token Registry</>}>
                    
                    {/* INSPECTOR */}
                    <Card className="mb-4 bg-light border-primary">
                        <Card.Body>
                            <Card.Title className="text-primary"><FaSearch className="me-2"/>Token Inspector</Card.Title>
                            <InputGroup className="mb-3">
                                <Form.Control 
                                    type="number" placeholder="Enter Token ID to Inspect" 
                                    value={inputTokenId} onChange={(e) => setInputTokenId(e.target.value)} 
                                />
                                <Button variant="primary" onClick={inspectToken}>Inspect</Button>
                            </InputGroup>

                            {tokenInspectorData && (
                                <div className="bg-white p-3 rounded border">
                                    <Row>
                                        <Col md={6}><strong>Total Supply:</strong> {tokenInspectorData.supply}</Col>
                                        <Col md={6}>
                                            <strong>Status: </strong>
                                            {tokenInspectorData.isExpired 
                                                ? <Badge bg="danger">EXPIRED</Badge> 
                                                : <Badge bg="success">VALID</Badge>
                                            }
                                        </Col>
                                        <Col md={6} className="mt-2"><strong>Expiry Date:</strong> {tokenInspectorData.expiryDate}</Col>
                                        <Col md={12} className="mt-2 text-truncate"><strong>URI:</strong> <span className="text-muted">{tokenInspectorData.uri}</span></Col>
                                    </Row>
                                </div>
                            )}
                        </Card.Body>
                    </Card>

                    {/* MASTER LIST */}
                    <h5 className="text-muted">Global Token History</h5>
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Initial Owner</th>
                                <th>Amount</th>
                                <th>Expiry</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allTokens.map(t => (
                                <tr key={t.id}>
                                    <td>#{t.id}</td>
                                    <td className="font-monospace text-truncate" style={{maxWidth: '150px'}}>{t.owner}</td>
                                    <td>{t.amount}</td>
                                    <td>{t.expiry}</td>
                                </tr>
                            ))}
                            {allTokens.length === 0 && <tr><td colSpan="4" className="text-center">No tokens minted yet.</td></tr>}
                        </tbody>
                    </Table>
                </Tab>

                {/* --- TAB 3: DANGER ZONE --- */}
                <Tab eventKey="danger" title={<><FaExclamationTriangle className="me-1"/> Danger Zone</>}>
                    <Alert variant="danger">
                        <Alert.Heading><FaExclamationTriangle/> Irreversible Action</Alert.Heading>
                        <p>
                            Renouncing the Admin Role will permanently remove your ability to manage Issuers or Verifiers.
                            The contract will become fully autonomous.
                        </p>
                        <hr />
                        <div className="d-flex justify-content-end">
                            <Button variant="outline-danger" onClick={handleRenounceAdmin}>
                                Renounce Admin Role
                            </Button>
                        </div>
                    </Alert>
                </Tab>
            </Tabs>
        </Container>
    );
};

export default AdminPanel;