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
  const { currentUser } = useAuth();
  
  // Fetch real chat history from backend
  useEffect(() => {
    if (!currentUser) {
      setChatHistory([]);
      setFilteredHistory([]);
      return;
    }
    chatService.getChatHistory()
      .then((history) => {
        setChatHistory(history);
        setFilteredHistory(history);
      })
      .catch(() => {
        setChatHistory([]);
        setFilteredHistory([]);
      });
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
        chat.title.toLowerCase().includes(lowerSearchTerm) ||
        chat.messages.some(msg => msg.content.toLowerCase().includes(lowerSearchTerm))
      );
    });
    
    setFilteredHistory(filtered);
  }, [searchTerm, chatHistory]);
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  const deleteChat = async (id) => {
    if (!currentUser) return;
    try {
      await chatService.deleteChat(id);
      setChatHistory(prevHistory => prevHistory.filter(chat => chat.id !== id));
      setFilteredHistory(prevHistory => prevHistory.filter(chat => chat.id !== id));
    } catch (e) {
      // Optionally show error
    }
  };
  
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
        </div>
      </div>
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
            <div key={chat.id} className="history-item">
              <div className="history-item-header">
                <h3 className="history-item-title">{chat.title}</h3>
                <div className="history-item-actions">
                  <span className="history-item-date">
                    <FaCalendarAlt /> {formatDate(chat.date)}
                  </span>
                  <button 
                    className="delete-chat-button" 
                    onClick={() => deleteChat(chat.id)}
                    title="Delete this conversation"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
              
              <div className="history-item-preview">
                {chat.messages.slice(0, 2).map((message, index) => (
                  <div key={index} className={`preview-message ${message.role}`}>
                    <strong>{message.role === 'user' ? 'You' : 'Krishna'}:</strong>
                    <span>
                      {message.content.length > 100
                        ? `${message.content.substring(0, 100)}...`
                        : message.content}
                    </span>
                  </div>
                ))}
              </div>
              
              <Link to={`/chat?id=${chat.id}`} className="view-full-chat">
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