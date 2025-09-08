import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaTrash, FaSpinner, FaLanguage } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../contexts/AuthContext';
import { chatService } from '../../services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState('hindi');
  const messagesEndRef = useRef(null);
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setShowLoginPrompt(true);
    } else {
      setShowLoginPrompt(false);
    }
  }, [currentUser]);

  useEffect(() => {
    const storedLang = localStorage.getItem('chatLanguage');
    if (storedLang) setLanguage(storedLang);
  }, []);

  useEffect(() => {
    localStorage.setItem('chatLanguage', language);
  }, [language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatId = params.get('id');
    if (chatId && currentUser) {
      setHistoryLoading(true);
      console.log('🔍 Fetching chat by ID:', chatId);
      chatService.getChatById(chatId)
        .then(chat => {
          console.log('✅ Chat loaded:', chat);
          setMessages(chat.messages?.filter(
            msg => msg.role === 'user' || msg.role === 'assistant'
          ) || []);
          setIsHistoryView(true);
        })
        .catch(error => {
          console.error('❌ Error loading chat history:', error);
          setMessages([]);
        })
        .finally(() => setHistoryLoading(false));
    } else {
      setIsHistoryView(false);
    }
  }, [location.search, currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    if (isHistoryView) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    setIsLoading(true);

    try {
      console.log('🔍 Sending message:', input, 'Language:', language);
      const response = await chatService.sendMessage(input, language);
      console.log('✅ API response:', response);

      let responseContent = response.response || 'Sorry, no response received';
      setMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      if (error.response?.status === 401) {
        setShowLoginPrompt(true);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, there was an error processing your request. Please try again.' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('chatMessages');
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'english' ? 'hindi' : 'english');
  };

  const handleLoginRedirect = () => {
    navigate('/login');
  };

  const handleRegisterRedirect = () => {
    navigate('/register');
  };

  if (showLoginPrompt) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h1>Chat with Krishna</h1>
        </div>
        <div className="login-prompt">
          <div className="login-prompt-content">
            <img src="/logo3.png" alt="ASK KRISHNA Logo" className="login-prompt-logo" />
            <h2>Please Login or Register</h2>
            <p>To start chatting with Krishna, you need to be logged in.</p>
            <div className="login-prompt-actions">
              <button onClick={handleLoginRedirect} className="login-button">
                Login
              </button>
              <button onClick={handleRegisterRedirect} className="register-button">
                Register
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Chat with Krishna</h1>
        <div className="chat-actions">
          <button
            className="language-toggle"
            onClick={toggleLanguage}
            title={`Switch to ${language === 'english' ? 'Hindi' : 'English'}`}
          >
            <FaLanguage />
            <span>{language === 'english' ? 'EN' : 'HI'}</span>
          </button>
          <button className="clear-chat" onClick={clearChat} title="Clear chat history">
            <FaTrash />
          </button>
        </div>
      </div>

      {historyLoading ? (
        <div className="loading-indicator"><FaSpinner className="spinner" /> Loading conversation...</div>
      ) : (
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <img src="/logo3.png" alt="ASK KRISHNA Logo" className="empty-chat-logo" />
              <h2>Welcome to ASK KRISHNA</h2>
              <p>Ask any question about the Bhagavad Gita</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ))
          )}
          {isLoading && !isHistoryView && (
            <div className="message assistant loading">
              <div className="loading-indicator">
                <FaSpinner className="spinner" />
                <span>Krishna is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form className="input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the Bhagavad Gita..."
          disabled={isLoading || isHistoryView}
        />
        <button type="submit" disabled={isLoading || !input.trim() || isHistoryView}>
          <FaPaperPlane />
        </button>
      </form>
    </div>
  );
};

export default Chat;