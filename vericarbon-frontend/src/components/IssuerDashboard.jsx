import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { uploadToPinata } from '../utils/ipfs';
import { 
    CERTIFICATION_CONTRACT_ADDRESS, CERTIFICATION_CONTRACT_ABI,
    ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI 
} from '../config';
import { Container, Row, Col, Card, Form, Button, ProgressBar, Badge, Alert, Spinner } from 'react-bootstrap';
import { FaIndustry, FaSync, FaFileAlt, FaFileUpload, FaLayerGroup, FaCoins } from 'react-icons/fa';

const IssuerDashboard = () => {
    // --- STATE ---
    const [projects, setProjects] = useState([]);
    const [stats, setStats] = useState({ totalCount: 0, totalVolume: 0 });
    
    // Form State
    const [form, setForm] = useState({ company: '', amount: '', duration: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [verifierCount, setVerifierCount] = useState(0);

    const getProviderAndSigner = async () => {
        if (!window.ethereum) return null;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        return { provider, signer };
    };

    // ==================================================================================
    // 1. FETCH DATA (My Projects + Live Status)
    // ==================================================================================
    const refreshDashboard = async () => {
        try {
            setLoading(true);
            const { provider, signer } = await getProviderAndSigner();
            const userAddress = await signer.getAddress();
            
            const certContract = new ethers.Contract(CERTIFICATION_CONTRACT_ADDRESS, CERTIFICATION_CONTRACT_ABI, provider);
            const rolesContract = new ethers.Contract(ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI, provider);

            // A. Get Total Verifiers (for progress bars)
            const vCount = await rolesContract.verifierCount();
            setVerifierCount(Number(vCount));

            // B. Find My Proposals (Event Log)
            const filter = certContract.filters.ProjectProposed(null, userAddress); 
            const events = await certContract.queryFilter(filter);

            // C. Fetch LIVE details for each project
            const projectPromises = events.map(async (e) => {
                const id = e.args[0]; 
                const details = await certContract.projectProposals(id);
                
                return {
                    id: id.toString(),
                    company: details[1],
                    amount: details[2].toString(),
                    uri: details[3],
                    duration: details[4].toString(),
                    approvalCount: Number(details[5]),
                    isMinted: details[6],
                    txHash: e.transactionHash
                };
            });

            const myProjects = await Promise.all(projectPromises);
            const sortedProjects = myProjects.reverse(); // Newest first

            // D. Calculate Stats
            const totalVol = sortedProjects.reduce((acc, curr) => acc + Number(curr.amount), 0);

            setProjects(sortedProjects);
            setStats({ totalCount: sortedProjects.length, totalVolume: totalVol });
            setLoading(false);

        } catch (error) {
            console.error("Dashboard Error:", error);
            setStatus("Error loading dashboard.");
            setLoading(false);
        }
    };

    useEffect(() => { refreshDashboard(); }, []);

    // ==================================================================================
    // 2. ACTIONS
    // ==================================================================================
    
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handlePropose = async () => {
        if (!form.company || !form.amount || !form.duration || !selectedFile) {
            return alert("Please fill all fields and attach a document.");
        }
        
        try {
            setLoading(true);
            
            // 1. Upload to IPFS first
            setStatus('☁️ Uploading Document to IPFS...');
            const ipfsHash = await uploadToPinata(selectedFile);
            
            if (!ipfsHash) throw new Error("IPFS Upload failed");
            console.log("IPFS Hash generated:", ipfsHash);

            // 2. Send Blockchain Transaction
            setStatus('📝 Proposing Project... Check MetaMask.');
            const { signer } = await getProviderAndSigner();
            const contract = new ethers.Contract(CERTIFICATION_CONTRACT_ADDRESS, CERTIFICATION_CONTRACT_ABI, signer);

            const tx = await contract.proposeProject(form.company, form.amount, ipfsHash, form.duration);
            setStatus('Transaction sent. Waiting for confirmation...');
            await tx.wait();
            
            setStatus('Success! Project Proposed with IPFS Data.');
            setForm({ company: '', amount: '', duration: '' });
            setSelectedFile(null); 
            refreshDashboard(); 
        } catch (error) {
            console.error(error);
            setStatus('Error: ' + (error.reason || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Helpers
    const getProgress = (approvals) => {
        if (verifierCount === 0) return 0;
        return Math.min((approvals / verifierCount) * 100, 100);
    };

    const getStatusBadge = (p) => {
        if (p.isMinted) return <Badge bg="success">MINTED</Badge>;
        
        const hasConsensus = (p.approvalCount * 2) > verifierCount;
        if (hasConsensus) return <Badge bg="primary">READY TO MINT</Badge>;
        
        return <Badge bg="warning" text="dark">PENDING ({p.approvalCount}/{verifierCount})</Badge>;
    };

    const openDocument = (ipfsUri) => {
        if (!ipfsUri) return alert("No URI attached");
        const url = ipfsUri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
        window.open(url, '_blank');
    };

    return (
        <Container>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-dark"><FaIndustry className="me-2 text-primary" /> Issuer Dashboard</h2>
                <Button variant="link" onClick={refreshDashboard}>
                    <FaSync className="me-1" /> Refresh Data
                </Button>
            </div>

            {status && <Alert variant="info" onClose={() => setStatus('')} dismissible>{status}</Alert>}

            {/* STATS BAR */}
            <Row className="mb-4 text-center">
                <Col md={6}>
                    <Card className="bg-light border-0">
                        <Card.Body>
                            <h6 className="text-uppercase text-muted">Total Projects</h6>
                            <h3>{stats.totalCount}</h3>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="bg-light border-0">
                        <Card.Body>
                            <h6 className="text-uppercase text-muted">Total Volume</h6>
                            <h3 className="text-primary">{stats.totalVolume.toLocaleString()} <span className="fs-6 text-muted">Credits</span></h3>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row>
                {/* LEFT: NEW PROPOSAL FORM */}
                <Col lg={4} className="mb-4">
                    <Card className="shadow-sm border-0">
                        <Card.Body>
                            <Card.Title className="mb-4 text-primary"><FaFileAlt className="me-2" /> Create Proposal</Card.Title>
                            <Form>
                                <Form.Group className="mb-3">
                                    <Form.Label>Receiver Address</Form.Label>
                                    <Form.Control 
                                        type="text" placeholder="0x..." 
                                        value={form.company} onChange={(e) => setForm({...form, company: e.target.value})}
                                    />
                                </Form.Group>
                                
                                <Form.Group className="mb-3">
                                    <Form.Label>Credit Amount</Form.Label>
                                    <Form.Control 
                                        type="number" placeholder="e.g. 5000" 
                                        value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})}
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Expiry Duration (Days)</Form.Label>
                                    <Form.Control 
                                        type="number" placeholder="e.g. 365" 
                                        value={form.duration} onChange={(e) => setForm({...form, duration: e.target.value})} 
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Project Document (PDF)</Form.Label>
                                    <div className="d-flex align-items-center border rounded p-2 bg-light">
                                        <FaFileUpload className="me-2 text-muted" />
                                        <Form.Control type="file" onChange={handleFileChange} className="border-0 p-0 bg-transparent" />
                                    </div>
                                    {selectedFile && <small className="text-success d-block mt-1">Selected: {selectedFile.name}</small>}
                                </Form.Group>

                                <Button variant="primary" className="w-100" onClick={handlePropose} disabled={loading}>
                                    {loading ? <Spinner size="sm" animation="border" /> : 'Submit Proposal'}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                {/* RIGHT: PROJECT LIST */}
                <Col lg={8}>
                    <h4 className="mb-3 text-muted"><FaLayerGroup className="me-2" /> My Proposals</h4>
                    
                    {projects.length === 0 && (
                        <Alert variant="light" className="text-center py-5 border">
                            No projects found. Create your first one!
                        </Alert>
                    )}

                    {projects.map((p) => (
                        <Card key={p.id} className="mb-3 shadow-sm border-0">
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <h5 className="mb-0 fw-bold text-primary">Project #{p.id}</h5>
                                        <small className="text-muted font-monospace">To: {p.company}</small>
                                    </div>
                                    {getStatusBadge(p)}
                                </div>

                                <div className="d-flex justify-content-between align-items-center my-3">
                                    <div className="d-flex align-items-center">
                                        <FaCoins className="text-warning me-2 fs-4" />
                                        <h3 className="mb-0">{p.amount} <small className="fs-6 text-muted">VCC</small></h3>
                                    </div>
                                    <div className="text-end">
                                        <div className="fw-bold">{p.duration} Days Validity</div>
                                        <Button variant="link" className="p-0 text-decoration-none" onClick={() => openDocument(p.uri)}>
                                            <FaFileAlt className="me-1" /> View Doc
                                        </Button>
                                    </div>
                                </div>

                                <div className="d-flex align-items-center gap-2">
                                    <ProgressBar 
                                        now={getProgress(p.approvalCount)} 
                                        className="flex-grow-1" 
                                        variant={p.isMinted ? "success" : "info"}
                                        style={{height: '8px'}}
                                    />
                                    <small className="text-muted fw-bold">{p.approvalCount}/{verifierCount}</small>
                                </div>
                            </Card.Body>
                        </Card>
                    ))}
                </Col>
            </Row>
        </Container>
    );
};

export default IssuerDashboard;