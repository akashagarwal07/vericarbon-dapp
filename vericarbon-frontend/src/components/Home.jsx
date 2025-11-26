import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import { FaShieldAlt, FaChartLine, FaHourglassHalf, FaLeaf } from 'react-icons/fa';

const Home = () => {
  return (
    <Container className="text-center py-5">
      <div className="p-5 mb-4 bg-light rounded-3 shadow-sm">
        <h1 className="display-4 fw-bold text-success">
          <FaLeaf className="me-3" />VeriCarbon
        </h1>
        <p className="lead text-muted">
          The Decentralized, Transparent Carbon Credit Ecosystem.
        </p>
        <hr className="my-4" />
        <p>
          VeriCarbon leverages blockchain technology to prevent double-spending, ensure consensus-based verification, and enable instant global trading of carbon credits.
        </p>
        {/* <Button variant="primary" size="lg">Learn More</Button> */}
      </div>

      <Row className="g-4">
        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body>
              <div className="mb-3 text-primary">
                <FaShieldAlt size={50} />
              </div>
              <Card.Title>51% Consensus</Card.Title>
              <Card.Text>
                Projects are only minted after majority approval from a decentralized network of verifiers.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body>
              <div className="mb-3 text-success">
                <FaChartLine size={50} />
              </div>
              <Card.Title>Automated Market</Card.Title>
              <Card.Text>
                Buy and sell credits instantly using our Multi-Pool AMM with transparent, algorithmic pricing.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body>
              <div className="mb-3 text-warning">
                <FaHourglassHalf size={50} />
              </div>
              <Card.Title>Anti-Hoarding</Card.Title>
              <Card.Text>
                Credits come with built-in expiry dates to encourage active offsetting and prevent market manipulation.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Home;