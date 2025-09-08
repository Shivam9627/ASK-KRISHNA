import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaSearch, FaTrash, FaCalendarAlt, FaArrowRight } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../contexts/AuthContext';
import './History.css';
import { chatService } from '../../services/api';

const History = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  
  // Fetch real chat history from backend
  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser) {
        setChatHistory([]);
        setFilteredHistory([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError('');
        console.log('🔍 Fetching chat history for user:', currentUser.user_id);
        
        const history = await chatService.getHistory();
        console.log('✅ Chat history received:', history);
        
        let historyArray = Array.isArray(history) ? history : [];
        historyArray = historyArray.sort((a, b) => {
          const ta = (a.created_at ?? 0);
          const tb = (b.created_at ?? 0);
          if (tb !== ta) return tb - ta;
          return (b._id || '').localeCompare(a._id || '');
        });
        console.log('📊 Processed history array:', historyArray);
        
        setChatHistory(historyArray);
        setFilteredHistory(historyArray);
      } catch (err) {
        console.error('❌ Error fetching chat history:', err);
        setError('Failed to load chat history');
        setChatHistory([]);
        setFilteredHistory([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, [currentUser]);
  
  // Filter history based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredHistory(chatHistory);
      return;
    }
    
    const filtered = chatHistory.filter(chat => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      return (
        chat.title?.toLowerCase().includes(lowerSearchTerm) ||
        chat.messages?.some(msg => msg.content.toLowerCase().includes(lowerSearchTerm))
      );
    });
    
    setFilteredHistory(filtered);
  }, [searchTerm, chatHistory]);
  
  const formatDate = (dateString) => {
    try {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      return 'Unknown date';
    }
  };
  
  const deleteChat = async (id) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Deleting chat:', id);
      await chatService.deleteChat(id);
      setChatHistory(prevHistory => prevHistory.filter(chat => chat._id !== id));
      setFilteredHistory(prevHistory => prevHistory.filter(chat => chat._id !== id));
      console.log('✅ Chat deleted:', id);
    } catch (e) {
      console.error('❌ Error deleting chat:', e);
      setError('Failed to delete chat');
    }
  };

  const deleteAllChats = async () => {
    if (!currentUser) return;
    if (!window.confirm('Delete all your chat history? This cannot be undone.')) return;
    try {
      console.log('🧹 Deleting all chats for user:', currentUser.user_id);
      await chatService.deleteAllHistory();
      setChatHistory([]);
      setFilteredHistory([]);
      console.log('✅ All chats deleted');
    } catch (e) {
      console.error('❌ Error deleting all chats:', e);
      setError('Failed to delete all chats');
    }
  };
  
  if (loading) {
    return (
      <div className="history-container">
        <div className="history-header">
          <h1>Your Chat History</h1>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your chat history...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="history-container">
      <div className="history-header">
        <h1>Your Chat History</h1>
        <div className="search-bar">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search your conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {currentUser && filteredHistory.length > 0 && (
            <button className="delete-all-button" onClick={deleteAllChats} title="Delete all history">
              <FaTrash /> Delete All
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {!currentUser ? (
        <div className="empty-history">
          <h2>Please log in to view your chat history.</h2>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="empty-history">
          <h2>{searchTerm ? 'No matching conversations found' : 'No chat history yet'}</h2>
          <p>{searchTerm ? 'Try a different search term' : 'Start a conversation to see your history here'}</p>
          <Link to="/chat" className="start-chat-button">
            Start a new chat <FaArrowRight />
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {filteredHistory.map(chat => (
            <div key={chat._id} className="history-item">
              <div className="history-item-header">
                <h3 className="history-item-title">{chat.title || 'Untitled Conversation'}</h3>
                <div className="history-item-actions">
                  <span className="history-item-date">
                    <FaCalendarAlt /> {formatDate(chat.date)}
                  </span>
                  <button 
                    className="delete-chat-button" 
                    onClick={() => deleteChat(chat._id)}
                    title="Delete this conversation"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
              
              <div className="history-item-preview">
                {chat.messages?.slice(0, 2).map((message, index) => (
                  <div key={index} className={`preview-message ${message.role}`}>
                    <strong>{message.role === 'user' ? 'You' : 'Krishna'}:</strong>
                    <span>
                      {message.content?.length > 100
                        ? `${message.content.substring(0, 100)}...`
                        : message.content}
                    </span>
                  </div>
                ))}
              </div>
              
              <Link to={`/chat?id=${chat._id}`} className="view-full-chat">
                View full conversation <FaArrowRight />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;