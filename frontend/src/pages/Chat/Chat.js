import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaTrash, FaSpinner, FaLanguage } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../contexts/AuthContext';
import { chatService } from '../../services/api';
import { useLocation } from 'react-router-dom';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState('english'); // Default language
  const messagesEndRef = useRef(null);
  const { currentUser, incrementQuestionCount, questionCount, clearChatHistory } = useAuth();
  const location = useLocation();
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Add local state for guest question count to ensure immediate UI update
  const [guestQuestionCount, setGuestQuestionCount] = useState(questionCount);

  // Sync local guestQuestionCount with AuthContext on mount and when questionCount changes
  useEffect(() => {
    if (!currentUser) {
      setGuestQuestionCount(questionCount);
    }
  }, [questionCount, currentUser]);
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Load messages from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, []);
  
  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      // Make sure we're saving the complete message objects including thinking
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  }, [messages]);
  
  // Clear chat history and question count on logout
  useEffect(() => {
    if (!currentUser) {
      clearChatHistory();
      setMessages([]);
    }
  }, [currentUser, clearChatHistory]);
  
  // Load conversation by ID if present in URL (from history)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatId = params.get('id');
    if (chatId && currentUser) {
      setHistoryLoading(true);
      chatService.getChatById(chatId)
        .then(chat => {
          setMessages(chat.messages || []);
          setIsHistoryView(true);
        })
        .catch(() => {
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
    
    if (isHistoryView) return; // Prevent sending in history view

    // For guests, add the user message immediately and update question count
    if (!currentUser) {
      setMessages(prev => [...prev, { role: 'user', content: input }]);
      const newCount = incrementQuestionCount();
      setGuestQuestionCount(newCount); // Update local state for immediate UI feedback
      if (newCount > 10) {
        setMessages(prev => [
          ...prev,
          { 
            role: 'assistant', 
            content: 'You have reached the limit of 10 questions. Please sign up or log in to continue chatting.'
          }
        ]);
        setInput('');
        return;
      }
    } else {
      // For logged-in users, add the user message immediately
      setMessages(prev => [...prev, { role: 'user', content: input }]);
    }
    setInput('');
    setIsLoading(true);
    
    try {
      // Call the actual backend API using the chatService
      const response = await chatService.sendMessage(input, language);
      
      // Format the response from the backend
      let responseContent;
      
      // The backend returns both 'response' and 'thinking' fields
      if (response.response) {
        responseContent = response.response;
      } else {
        // Fallback if response format is different
        responseContent = typeof response === 'string' ? response : JSON.stringify(response);
      }
      
      // Create a message object that includes both response and thinking if available
      const assistantMessage = { 
        role: 'assistant', 
        content: responseContent,
        thinking: response.thinking || null
      };
      
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request. Please try again.'
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
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
      
      {/* Question limit info for guests */}
      {!currentUser && (
        <div className="question-limit-info">
          <p>Questions remaining: {10 - guestQuestionCount}/10</p>
          <p>Sign up or log in to ask unlimited questions</p>
        </div>
      )}
      
      {historyLoading ? (
        <div className="loading-indicator"><FaSpinner className="spinner" /> Loading conversation...</div>
      ) : (
      <>
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <img src="/logo.svg" alt="ASK KRISHNA Logo" className="empty-chat-logo" />
            <h2>Welcome to ASK KRISHNA</h2>
            <p>Ask any question about the Bhagavad Gita</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-content">
                {message.role === 'assistant' ? (
                  <>
                    {message.thinking && (
                      <details className="thinking-expander">
                        <summary>Show thinking process</summary>
                        <div className="thinking-content">
                          <ReactMarkdown>{message.thinking}</ReactMarkdown>
                        </div>
                      </details>
                    )}
                    {/* For Hindi, preserve markdown and formatting */}
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
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
      </>
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