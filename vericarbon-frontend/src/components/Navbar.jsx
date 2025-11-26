import { Link } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { FaLeaf, FaWallet } from 'react-icons/fa';

const AppNavbar = ({ account, role, connectWallet }) => {
  const formatAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const getRoleLabel = () => {
    if (!role) return "LOADING...";
    if (role === 'none') return "COMPANY"; 
    return role.toUpperCase();
  };

  let badgeVariant = "secondary";
  if (role === 'admin') badgeVariant = "danger";
  if (role === 'issuer') badgeVariant = "primary";
  if (role === 'verifier') badgeVariant = "success";
  if (role === 'none') badgeVariant = "info";

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-4 shadow-sm">
      <Container>
        <Navbar.Brand as={Link} to="/" className="fw-bold d-flex align-items-center">
          <FaLeaf className="me-2 text-success" /> VeriCarbon
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {account && role === 'admin' && <Nav.Link as={Link} to="/admin">Admin Panel</Nav.Link>}
            {account && role === 'issuer' && <Nav.Link as={Link} to="/issuer">Issuer Dashboard</Nav.Link>}
            {account && role === 'verifier' && <Nav.Link as={Link} to="/verifier">Verifier Dashboard</Nav.Link>}
            {account && role === 'none' && <Nav.Link as={Link} to="/market">Marketplace</Nav.Link>}
          </Nav>
          
          <Nav>
            {account ? (
              <div className="d-flex align-items-center gap-2">
                <Badge bg={badgeVariant} className="text-uppercase">
                  {getRoleLabel()}
                </Badge>
                <span className="text-light font-monospace" style={{fontSize: '0.9rem'}}>
                  {formatAddress(account)}
                </span>
              </div>
            ) : (
              <Button variant="outline-light" size="sm" onClick={connectWallet} className="d-flex align-items-center gap-2">
                <FaWallet /> Connect Wallet
              </Button>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;