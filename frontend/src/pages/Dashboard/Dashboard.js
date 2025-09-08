import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FaUser, 
  FaEnvelope, 
  FaHistory, 
  FaComments, 
  FaCalendarAlt, 
  FaEdit,
  FaCog,
  FaSignOutAlt
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { chatService } from '../../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [chatStats, setChatStats] = useState({
    totalChats: 0,
    recentChats: 0,
    lastChatDate: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError('');
        console.log('🔍 Fetching chat history for stats...');

        // Corrected to use getHistory() from api.js
        const history = await chatService.getHistory();
        console.log('✅ Chat history received:', history);

        // Ensure history is an array
        const historyArray = Array.isArray(history) ? history : [];
        
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const recentChats = historyArray.filter(chat => {
          try {
            const ts = chat.created_at 
              ? new Date(chat.created_at * 1000) 
              : chat.date 
                ? new Date(chat.date) 
                : null;
            return ts && ts >= oneWeekAgo;
          } catch (e) {
            console.warn('⚠️ Invalid date in chat:', chat);
            return false;
          }
        });

        // Backend sorts by created_at DESC; first item is most recent
        const lastChat = historyArray.length > 0 ? historyArray[0] : null;

        setChatStats({
          totalChats: historyArray.length,
          recentChats: recentChats.length,
          lastChatDate: lastChat 
            ? (lastChat.date || (lastChat.created_at ? new Date(lastChat.created_at * 1000).toISOString() : null)) 
            : null
        });
      } catch (error) {
        console.error('❌ Error fetching chat stats:', error);
        setError('Failed to load chat statistics. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentUser, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('❌ Failed to log out:', error);
      setError('Failed to log out. Please try again.');
    }
  };

  const formatDate = (value) => {
    if (!value) return 'No chats yet';
    try {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      // Handle epoch seconds, ISO strings, or other date formats
      if (typeof value === 'number') {
        return new Date(value * 1000).toLocaleDateString(undefined, options);
      }
      if (typeof value === 'string') {
        if (/^\d+(\.\d+)?$/.test(value)) {
          // Handle epoch seconds as string
          const secs = parseFloat(value);
          return new Date(secs * 1000).toLocaleDateString(undefined, options);
        }
        // Handle ISO string or other date formats
        return new Date(value).toLocaleDateString(undefined, options);
      }
      return 'Unknown date';
    } catch (e) {
      console.warn('⚠️ Error formatting date:', value, e);
      return 'Unknown date';
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome back, {currentUser.username}!</h1>
        <p>Here's your ASK KRISHNA dashboard</p>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '1rem 0' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      ) : (
        <div className="dashboard-content">
          {/* Profile Section */}
          <div className="dashboard-section profile-section">
            <div className="section-header">
              <h2>Your Profile</h2>
              <Link to="/profile" className="edit-profile-btn">
                <FaEdit />
                Edit Profile
              </Link>
            </div>
            
            <div className="profile-card">
              <div className="profile-avatar">
                {currentUser.profileImage ? (
                  <img 
                    src={currentUser.profileImage} 
                    alt="Profile" 
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    <FaUser />
                  </div>
                )}
              </div>
              
              <div className="profile-info">
                <h3>{currentUser.username}</h3>
                <div className="profile-detail">
                  <FaEnvelope />
                  <span>{currentUser.email}</span>
                </div>
                <div className="profile-detail">
                  <FaCalendarAlt />
                  <span>Member since {formatDate(currentUser.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Statistics */}
          <div className="dashboard-section stats-section">
            <div className="section-header">
              <h2>Chat Statistics</h2>
              <Link to="/history" className="view-history-btn">
                <FaHistory />
                View All
              </Link>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <FaComments />
                </div>
                <div className="stat-content">
                  <h3>{chatStats.totalChats}</h3>
                  <p>Total Conversations</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon recent">
                  <FaHistory />
                </div>
                <div className="stat-content">
                  <h3>{chatStats.recentChats}</h3>
                  <p>This Week</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon last">
                  <FaCalendarAlt />
                </div>
                <div className="stat-content">
                  <h3>{formatDate(chatStats.lastChatDate)}</h3>
                  <p>Last Chat</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-section actions-section">
            <div className="section-header">
              <h2>Quick Actions</h2>
            </div>
            
            <div className="actions-grid">
              <Link to="/chat" className="action-card primary">
                <div className="action-icon">
                  <FaComments />
                </div>
                <h3>Start New Chat</h3>
                <p>Ask Krishna a question</p>
              </Link>
              
              <Link to="/history" className="action-card">
                <div className="action-icon">
                  <FaHistory />
                </div>
                <h3>View History</h3>
                <p>See past conversations</p>
              </Link>
              
              <Link to="/profile" className="action-card">
                <div className="action-icon">
                  <FaCog />
                </div>
                <h3>Settings</h3>
                <p>Manage your profile</p>
              </Link>
              
              <button onClick={handleLogout} className="action-card logout">
                <div className="action-icon">
                  <FaSignOutAlt />
                </div>
                <h3>Logout</h3>
                <p>Sign out of your account</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;