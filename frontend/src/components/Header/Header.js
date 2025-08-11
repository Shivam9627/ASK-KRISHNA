import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FaBars, 
  FaTimes, 
  FaUser, 
  FaHistory, 
  FaSignOutAlt, 
  FaSignInAlt, 
  FaUserPlus, 
  FaCog, 
  FaTachometerAlt,
  FaChevronDown,
  FaComments
} from 'react-icons/fa';
import './Header.css';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isUserMenuOpen && !event.target.closest('.user-menu-container')) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      setIsMenuOpen(false);
      setIsUserMenuOpen(false);
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <header className="header">
      <div className="container header-container">
        <Link to="/" className="logo" onClick={closeMenus}>
          <img src="/logo3.png" alt="ASK KRISHNA Logo" className="logo-img" />
          <span className="logo-text">ASK KRISHNA</span>
        </Link>

        <nav className={`nav ${isMenuOpen ? 'active' : ''}`}>
          <ul className="nav-list">
            <li className="nav-item">
              <Link 
                to="/" 
                className={`nav-link ${isActive('/') ? 'active' : ''}`} 
                onClick={closeMenus}
              >
                Home
              </Link>
            </li>
            <li className="nav-item">
              <Link 
                to="/chat" 
                className={`nav-link ${isActive('/chat') ? 'active' : ''}`} 
                onClick={closeMenus}
              >
                <FaComments className="nav-icon" />
                Chat
              </Link>
            </li>
            
            {currentUser ? (
              <>
                <li className="nav-item">
                  <Link 
                    to="/dashboard" 
                    className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`} 
                    onClick={closeMenus}
                  >
                    <FaTachometerAlt className="nav-icon" />
                    Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    to="/history" 
                    className={`nav-link ${isActive('/history') ? 'active' : ''}`} 
                    onClick={closeMenus}
                  >
                    <FaHistory className="nav-icon" />
                    History
                  </Link>
                </li>
                
                {/* User Menu Dropdown */}
                <li className="nav-item user-menu-container">
                  <button 
                    className="user-menu-trigger" 
                    onClick={toggleUserMenu}
                    aria-expanded={isUserMenuOpen}
                  >
                    <div className="user-avatar">
                      {currentUser.profileImage ? (
                        <img 
                          src={currentUser.profileImage} 
                          alt={currentUser.username} 
                          className="avatar-img"
                        />
                      ) : (
                        <FaUser className="avatar-icon" />
                      )}
                    </div>
                    <span className="user-name">{currentUser.username}</span>
                    <FaChevronDown className={`dropdown-icon ${isUserMenuOpen ? 'rotated' : ''}`} />
                  </button>
                  
                  {isUserMenuOpen && (
                    <div className="user-dropdown">
                      <div className="dropdown-header">
                        <div className="dropdown-user-info">
                          <div className="dropdown-avatar">
                            {currentUser.profileImage ? (
                              <img 
                                src={currentUser.profileImage} 
                                alt={currentUser.username} 
                                className="dropdown-avatar-img"
                              />
                            ) : (
                              <FaUser className="dropdown-avatar-icon" />
                            )}
                          </div>
                          <div className="dropdown-user-details">
                            <span className="dropdown-username">{currentUser.username}</span>
                            <span className="dropdown-email">{currentUser.email}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="dropdown-menu">
                        <Link 
                          to="/profile" 
                          className="dropdown-item"
                          onClick={closeMenus}
                        >
                          <FaCog className="dropdown-item-icon" />
                          Profile Settings
                        </Link>
                        <Link 
                          to="/history" 
                          className="dropdown-item"
                          onClick={closeMenus}
                        >
                          <FaHistory className="dropdown-item-icon" />
                          Chat History
                        </Link>
                        <Link 
                          to="/dashboard" 
                          className="dropdown-item"
                          onClick={closeMenus}
                        >
                          <FaTachometerAlt className="dropdown-item-icon" />
                          Dashboard
                        </Link>
                        
                        <div className="dropdown-divider"></div>
                        
                        <button 
                          onClick={handleLogout} 
                          className="dropdown-item logout-item"
                        >
                          <FaSignOutAlt className="dropdown-item-icon" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link 
                    to="/login" 
                    className="nav-link auth-link" 
                    onClick={closeMenus}
                  >
                    <FaSignInAlt className="nav-icon" />
                    Login
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    to="/register" 
                    className="nav-link auth-link register-link" 
                    onClick={closeMenus}
                  >
                    <FaUserPlus className="nav-icon" />
                    Register
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
      
      {/* Backdrop for mobile menu */}
      {isMenuOpen && (
        <div className="menu-backdrop" onClick={closeMenus}></div>
      )}
    </header>
  );
};

export default Header;