import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
    CERTIFICATION_CONTRACT_ADDRESS, CERTIFICATION_CONTRACT_ABI,
    ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI 
} from '../config';
import { Container, Card, Button, Badge, ProgressBar, Nav, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { FaCheckCircle, FaClock, FaHistory, FaRocket, FaFilePdf, FaPenNib, FaSync, FaArrowAltCircleDown, FaArrowRight, FaEye } from 'react-icons/fa';

const VerifierDashboard = () => {
    // --- STATE ---
    const [projects, setProjects] = useState([]);
    const [mySignatures, setMySignatures] = useState(new Set()); 
    const [verifierCount, setVerifierCount] = useState(0);
    
    const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'ready', 'history'
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const getProviderAndSigner = async () => {
        if (!window.ethereum) return null;
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        return { provider, signer };
    };

    // 1. FETCH DATA
    const refreshDashboard = async () => {
        try {
            setLoading(true);
            const { provider, signer } = await getProviderAndSigner();
            const userAddress = await signer.getAddress();
            
            const certContract = new ethers.Contract(CERTIFICATION_CONTRACT_ADDRESS, CERTIFICATION_CONTRACT_ABI, provider);
            const rolesContract = new ethers.Contract(ROLES_CONTRACT_ADDRESS, ROLES_CONTRACT_ABI, provider);

            // A. Global Stats
            const vCount = await rolesContract.verifierCount();
            setVerifierCount(Number(vCount));

            // B. Check My Vote History
            const myVoteFilter = certContract.filters.ProjectApproved(null, userAddress);
            const myVoteEvents = await certContract.queryFilter(myVoteFilter);
            const mySignedIds = new Set(myVoteEvents.map(e => e.args[0].toString()));
            setMySignatures(mySignedIds);

            // C. Fetch All Proposals
            const proposalFilter = certContract.filters.ProjectProposed();
            const proposalEvents = await certContract.queryFilter(proposalFilter);

            // D. Fetch Live Details
            const projectPromises = proposalEvents.map(async (e) => {
                const id = e.args[0];
                const details = await certContract.projectProposals(id);
                
                return {
                    id: id.toString(),
                    issuer: details[0],
                    company: details[1],
                    amount: details[2].toString(),
                    uri: details[3],
                    duration: details[4].toString(),
                    approvalCount: Number(details[5]),
                    isMinted: details[6]
                };
            });

            const allProjects = await Promise.all(projectPromises);
            setProjects(allProjects.reverse()); 
            setLoading(false);

        } catch (error) {
            console.error("Error fetching data:", error);
            setStatus("Error loading dashboard.");
            setLoading(false);
        }
    };

    useEffect(() => { refreshDashboard(); }, []);

    // 2. ACTIONS
    const handleApprove = async (id) => {
        try {
            setStatus(`Approving Project #${id}... Check MetaMask.`);
            const { signer } = await getProviderAndSigner();
            const contract = new ethers.Contract(CERTIFICATION_CONTRACT_ADDRESS, CERTIFICATION_CONTRACT_ABI, signer);

            const tx = await contract.approveProject(id);
            setStatus('Transaction sent. Waiting...');
            await tx.wait();
            
            setStatus(`Success! Voted for Project #${id}`);
            refreshDashboard();
        } catch (error) {
            console.error(error);
            setStatus('Error: ' + (error.reason || error.message));
        }
    };

    const handleExecuteMint = async (id) => {
        try {
            setStatus(`Minting Project #${id}... Check MetaMask.`);
            const { signer } = await getProviderAndSigner();
            const contract = new ethers.Contract(CERTIFICATION_CONTRACT_ADDRESS, CERTIFICATION_CONTRACT_ABI, signer);

            const tx = await contract.executeProjectMint(id);
            setStatus('Minting on blockchain...');
            await tx.wait();
            
            setStatus(`🎉 SUCCESS! Project #${id} Minted & Distributed!`);
            refreshDashboard();
        } catch (error) {
            console.error(error);
            setStatus('Error: ' + (error.reason || error.message));
        }
    };

    // 3. HELPERS
    const openDocument = (ipfsUri) => {
        if (!ipfsUri) return alert("No URI attached");
        const url = ipfsUri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
        window.open(url, '_blank');
    };

    // Filter Logic
    const filteredProjects = projects.filter(p => {
        const hasConsensus = (p.approvalCount * 2) > verifierCount;
        if (activeTab === 'history') return p.isMinted; 
        if (activeTab === 'ready') return !p.isMinted && hasConsensus;
        if (activeTab === 'pending') return !p.isMinted && !hasConsensus;
        return true;
    });

    return (
        <Container>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-dark"><FaCheckCircle className="me-2 text-success" /> Verifier Work Queue</h2>
                <Button variant="link" onClick={refreshDashboard} disabled={loading}>
                    {loading ? <Spinner size="sm" animation="border" /> : <><FaSync className="me-1"/> Refresh List</>}
                </Button>
            </div>

            {status && <Alert variant="info" onClose={() => setStatus('')} dismissible>{status}</Alert>}

            {/* TABS */}
            <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white pt-3 border-bottom-0">
                    <Nav 
                        variant="tabs" 
                        activeKey={activeTab} 
                        onSelect={(k) => setActiveTab(k)}
                        className="justify-content-start"
                    >
                        <Nav.Item>
                            <Nav.Link eventKey="pending">
                                <FaClock className="me-1 text-warning" /> Needs Review <Badge bg="secondary" className="ms-1">{projects.filter(p => !p.isMinted && !((p.approvalCount * 2) > verifierCount)).length}</Badge>
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="ready">
                                <FaRocket className="me-1 text-primary" /> Ready to Mint <Badge bg="primary" className="ms-1">{projects.filter(p => !p.isMinted && ((p.approvalCount * 2) > verifierCount)).length}</Badge>
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="history">
                                <FaHistory className="me-1 text-muted" /> History
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                </Card.Header>
            </Card>

            {/* PROJECT LIST */}
            <Row>
                {filteredProjects.length === 0 && (
                    <Col>
                        <div className="text-center py-5 text-muted bg-light rounded-3 border border-light">
                            <h4>No projects in this category.</h4>
                            <p>Great job! You're all caught up.</p>
                        </div>
                    </Col>
                )}

                {filteredProjects.map(p => {
                    const iHaveSigned = mySignatures.has(p.id);
                    const progressPct = verifierCount > 0 ? (p.approvalCount / verifierCount) * 100 : 0;
                    const hasConsensus = (p.approvalCount * 2) > verifierCount;

                    return (
                        <Col xs={12} key={p.id} className="mb-3">
                            <Card className="shadow-sm border-0">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div>
                                            <h5 className="mb-1 fw-bold text-primary">Project #{p.id}</h5>
                                            <small className="text-muted font-monospace">Issuer: {p.issuer}</small>
                                        </div>
                                        {iHaveSigned && <Badge bg="success" pill>YOU SIGNED <FaCheckCircle/></Badge>}
                                        {!iHaveSigned && !p.isMinted && <Badge bg="warning" text="dark" pill>ACTION REQUIRED</Badge>}
                                    </div>

                                    <Row className="mb-3">
                                        <Col md={3}>
                                            <small className="text-muted d-block">CREDIT AMOUNT</small>
                                            <span className="h5">{p.amount} VCC</span>
                                        </Col>
                                        <Col md={3}>
                                            <small className="text-muted d-block">RECIPIENT</small>
                                            <span className="font-monospace text-truncate d-block" style={{maxWidth: '150px'}}>{p.company}</span>
                                        </Col>
                                        <Col md={3}>
                                            <small className="text-muted d-block">VALIDITY</small>
                                            <span>{p.duration} Days</span>
                                        </Col>
                                        <Col md={3} className="text-end">
                                            <Button variant="link" className="p-0 text-decoration-none fw-bold" onClick={() => openDocument(p.uri)}>
                                                <FaFilePdf className="me-1" /> View Document <FaEye/>
                                            </Button>
                                        </Col>
                                    </Row>

                                    <div className="mb-3">
                                        <div className="d-flex justify-content-between mb-1">
                                            <small className="fw-bold text-muted">CONSENSUS PROGRESS</small>
                                            <small className="fw-bold text-primary">{p.approvalCount} / {verifierCount} Signatures</small>
                                        </div>
                                        <ProgressBar 
                                            now={progressPct} 
                                            variant={hasConsensus ? "success" : "info"} 
                                            style={{height: '10px'}}
                                        />
                                    </div>

                                    <div className="d-flex gap-2">
                                        {!p.isMinted && !iHaveSigned && (
                                            <Button variant="outline-primary" onClick={() => handleApprove(p.id)}>
                                                <FaPenNib className="me-2" /> Add Signature
                                            </Button>
                                        )}
                                        {!p.isMinted && hasConsensus && (
                                            <Button variant="primary" className="flex-grow-1" onClick={() => handleExecuteMint(p.id)}>
                                                <FaRocket className="me-2" /> Execute Final Mint
                                            </Button>
                                        )}
                                        {p.isMinted && (
                                            <Alert variant="success" className="w-100 py-2 mb-0 text-center">
                                                <strong>Verified & Distributed</strong>
                                            </Alert>
                                        )}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </Container>
    );
};

export default VerifierDashboard;