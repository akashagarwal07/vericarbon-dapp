// src/App.jsx
import { useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { checkUserRole } from './utils/roleChecker';
import 'bootstrap/dist/css/bootstrap.min.css'; // Ensure Bootstrap CSS is loaded
import './App.css'; // Custom overrides if any

// Components
import AppNavbar from './components/Navbar'; // Renamed to avoid conflict
import Home from './components/Home';
import AdminPanel from './components/AdminPanel';
import IssuerDashboard from './components/IssuerDashboard';
import VerifierDashboard from './components/VerifierDashboard';
import Marketplace from './components/Marketplace';

import Container from 'react-bootstrap/Container';
import Spinner from 'react-bootstrap/Spinner';

function App() {
  const [account, setAccount] = useState(null);
  const [role, setRole] = useState(null); 
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setLoading(true);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const userAccount = accounts[0];
        setAccount(userAccount);

        const provider = new ethers.BrowserProvider(window.ethereum);
        const userRole = await checkUserRole(userAccount, provider);
        setRole(userRole);

        // Redirect logic based on role
        switch (userRole) {
            case 'admin': navigate('/admin'); break;
            case 'issuer': navigate('/issuer'); break;
            case 'verifier': navigate('/verifier'); break;
            case 'company': navigate('/market'); break; // Registered companies go to Market
            case 'none': navigate('/market'); break; // New users go to Register
            default: navigate('/');
        }
        
      } catch (error) {
        console.error("Error connecting", error);
      } finally {
        setLoading(false);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  // Loading Screen Component
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <h4 className="mt-3 text-muted">Connecting to Blockchain...</h4>
        </div>
      </div>
    );
  }

  return (
    <div className="App bg-light min-vh-100">
      {/* Navbar is always visible */}
      <AppNavbar account={account} role={role} connectWallet={connectWallet} />

      {/* Main Content Area */}
      <Container className="py-4">
        <Routes>
          <Route path="/" element={<Home />} />

          {/* Strictly Protected Routes */}
          <Route path="/admin" element={role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
          <Route path="/issuer" element={role === 'issuer' ? <IssuerDashboard /> : <Navigate to="/" />} />
          <Route path="/verifier" element={role === 'verifier' ? <VerifierDashboard /> : <Navigate to="/" />} />
          
          {/* Company Routes */}
          <Route path="/market" element={role === 'company'||'none' ? <Marketplace /> : <Navigate to="/" />} />
          

        </Routes>
      </Container>
      
      {/* Footer (Optional) */}
      <footer className="text-center py-4 text-muted mt-auto">
        <small>© 2025 VeriCarbon. Built on Sepolia Testnet.</small>
      </footer>
    </div>
  );
}

export default App;