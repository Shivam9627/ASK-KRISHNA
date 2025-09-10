import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaTrash, FaSpinner, FaLanguage, FaMicrophone, FaVolumeUp } from 'react-icons/fa';
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
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(null); // Track which message is being spoken
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Initialize SpeechRecognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = language === 'hindi' ? 'hi-IN' : 'en-IN';
      recognitionRef.current.interimResults = true;
      recognitionRef.current.continuous = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInput(transcript);
        console.log('🎙️ Speech recognized:', transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          setError('No speech detected. Please try again.');
        } else if (event.error === 'not-allowed') {
          setError('Microphone permission denied. Please enable it in your browser settings.');
        } else {
          setError('Speech recognition failed. Please try again.');
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        console.log('🎙️ Speech recognition stopped');
      };
    } else {
      console.warn('⚠️ SpeechRecognition API not supported in this browser');
      setError('Speech recognition is not supported in your browser.');
    }
  }, [language]);

  // Check authentication status
  useEffect(() => {
    if (!currentUser) {
      setShowLoginPrompt(true);
      setMessages([]);
      setIsHistoryView(false);
    } else {
      setShowLoginPrompt(false);
    }
  }, [currentUser]);

  // Load saved language preference
  useEffect(() => {
    const storedLang = localStorage.getItem('chatLanguage');
    if (storedLang) {
      console.log('🔍 Loading saved language:', storedLang);
      setLanguage(storedLang);
    }
  }, []);

  // Save language preference
  useEffect(() => {
    console.log('🔍 Saving language to localStorage:', language);
    localStorage.setItem('chatLanguage', language);
  }, [language]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history if viewing a specific chat
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatId = params.get('id');
    if (chatId && currentUser) {
      setHistoryLoading(true);
      console.log('🔍 Fetching chat by ID:', chatId);
      chatService.getChatById(chatId)
        .then(chat => {
          console.log('✅ Chat loaded:', chat);
          const chatMessages = chat.messages?.filter(
            msg => msg.role === 'user' || msg.role === 'assistant'
          ) || [];
          setMessages(chatMessages);
          setIsHistoryView(true);
        })
        .catch(error => {
          console.error('❌ Error loading chat history:', error);
          setError('Failed to load chat history. Please try again.');
          setMessages([]);
          setIsHistoryView(true);
        })
        .finally(() => {
          setHistoryLoading(false);
        });
    } else {
      setIsHistoryView(false);
      setMessages([]);
    }
  }, [location.search, currentUser]);

  // Handle speech input
  const handleMicClick = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = language === 'hindi' ? 'hi-IN' : 'en-IN';
        recognitionRef.current.start();
        setIsListening(true);
        setError('');
        console.log('🎙️ Starting speech recognition in', recognitionRef.current.lang);
      } catch (err) {
        console.error('❌ Error starting speech recognition:', err);
        setError('Failed to start speech recognition. Please check microphone permissions.');
        setIsListening(false);
      }
    }
  };

  // Handle text-to-speech
  const handleSpeak = (text, messageIndex) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking === messageIndex) {
        window.speechSynthesis.cancel();
        setIsSpeaking(null);
        console.log('🔊 Stopped speaking');
        return;
      }

      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hindi' ? 'hi-IN' : 'en-IN';

      // Select appropriate voice
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang === (language === 'hindi' ? 'hi-IN' : 'en-IN')) || voices[0];
      utterance.voice = voice;
      utterance.volume = 1.0;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(messageIndex);
        console.log('🔊 Started speaking:', text.substring(0, 50) + '...');
      };
      utterance.onend = () => {
        setIsSpeaking(null);
        console.log('🔊 Finished speaking');
      };
      utterance.onerror = (event) => {
        console.error('❌ Speech synthesis error:', event.error);
        setIsSpeaking(null);
        setError('Failed to play audio. Please try again.');
      };

      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('⚠️ SpeechSynthesis API not supported in this browser');
      setError('Text-to-speech is not supported in your browser.');
    }
  };

  // Handle sending a message
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    if (isHistoryView) {
      setError('Cannot send messages in history view. Start a new chat.');
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      console.log('🔍 Sending message:', input, 'Language:', language);
      const response = await chatService.sendMessage(input, language);
      console.log('✅ API response:', response);

      const responseContent = response.response || 'Sorry, no response received';
      setMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      console.log('Error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data
      });
      let errorMessage = 'Sorry, there was an error processing your request. Please try again.';
      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please log in again.';
        setShowLoginPrompt(true);
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.error || 'Invalid request. Please check your input.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later or contact support.';
      }
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear chat messages
  const clearChat = () => {
    if (isHistoryView) {
      setError('Cannot clear messages in history view.');
      return;
    }
    setMessages([]);
    setError('');
    localStorage.removeItem('chatMessages');
    console.log('🗑️ Chat messages cleared');
  };

  // Toggle language between English and Hindi
  const toggleLanguage = () => {
    setLanguage(prev => {
      const newLang = prev === 'english' ? 'hindi' : 'english';
      console.log('🔄 Switching language to:', newLang);
      return newLang;
    });
  };

  // Redirect to login or register
  const handleLoginRedirect = () => {
    console.log('🔍 Redirecting to login');
    navigate('/login');
  };

  const handleRegisterRedirect = () => {
    console.log('🔍 Redirecting to register');
    navigate('/register');
  };

  // Render login prompt if not authenticated
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
          <button
            className="clear-chat"
            onClick={clearChat}
            title="Clear chat history"
            disabled={isHistoryView}
          >
            <FaTrash />
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <span className="close-btn" onClick={() => setError('')}>
            &times;
          </span>
        </div>
      )}

      {historyLoading ? (
        <div className="loading-indicator">
          <FaSpinner className="spinner" />
          Loading conversation...
        </div>
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
              <div key={idx} className={`message-row ${msg.role}-row`}>
                {msg.role === 'assistant' && (
                  <button
                    className={`listen-btn ${isSpeaking === idx ? 'playing' : ''}`}
                    onClick={() => handleSpeak(msg.content, idx)}
                    title={isSpeaking === idx ? 'Stop' : 'Listen'}
                  >
                    <span className="listen-btn-icon">
                      <FaVolumeUp />
                    </span>
                    {isSpeaking === idx && (
                      <div className="listen-btn-waves">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    )}
                  </button>
                )}
                <div className={`message ${msg.role}`}>
                  <div className={`message-bubble ${msg.role}-bubble`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && !isHistoryView && (
            <div className="message-row assistant-row">
              <div className="message assistant loading">
                <div className="loading-indicator">
                  <FaSpinner className="spinner" />
                  <span>Krishna is thinking...</span>
                </div>
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
        <button
          type="button"
          className={`mic-button ${isListening ? 'active' : ''}`}
          onClick={handleMicClick}
          title={isListening ? 'Stop Listening' : 'Start Listening'}
          disabled={isLoading || isHistoryView}
        >
          <FaMicrophone />
        </button>
        <button type="submit" disabled={isLoading || !input.trim() || isHistoryView}>
          <FaPaperPlane />
        </button>
      </form>
    </div>
  );
};

export default Chat;