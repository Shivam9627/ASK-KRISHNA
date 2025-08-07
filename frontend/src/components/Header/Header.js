import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FaBars, FaTimes, FaUser, FaHistory, FaSignOutAlt, FaSignInAlt, FaUserPlus } from 'react-icons/fa';
import './Header.css';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <header className="header">
      <div className="container header-container">
        <Link to="/" className="logo">
          <img src="/logo3.png" alt="ASK KRISHNA Logo" className="logo-img" />
          <span className="logo-text">ASK KRISHNA</span>
        </Link>

        <nav className={`nav ${isMenuOpen ? 'active' : ''}`}>
          <ul className="nav-list">
            <li className="nav-item">
              <Link to="/" className="nav-link" onClick={() => setIsMenuOpen(false)}>Home</Link>
            </li>
            <li className="nav-item">
              <Link to="/chat" className="nav-link" onClick={() => setIsMenuOpen(false)}>Chat</Link>
            </li>
            {currentUser ? (
              <>
                <li className="nav-item">
                  <Link to="/history" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                    <FaHistory className="nav-icon" /> History
                  </Link>
                </li>
                <li className="nav-item user-info">
                  <span className="user-greeting">
                    <FaUser className="nav-icon" /> {currentUser.username}
                  </span>
                </li>
                <li className="nav-item">
                  <button onClick={handleLogout} className="logout-btn">
                    <FaSignOutAlt className="nav-icon" /> Logout
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link to="/login" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                    <FaSignInAlt className="nav-icon" /> Login
                  </Link>
                </li>
                <li className="nav-item">
                  <Link to="/register" className="nav-link register-link" onClick={() => setIsMenuOpen(false)}>
                    <FaUserPlus className="nav-icon" /> Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        <button className="menu-toggle" onClick={toggleMenu}>
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
    </header>
  );
};

export default Header;