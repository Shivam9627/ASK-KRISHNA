import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaTrash, FaSpinner, FaLanguage, FaPlay, FaPause, FaMicrophone, FaMicrophoneSlash, FaCog } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../contexts/AuthContext';
import { chatService } from '../../services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState('english'); // Default language
  const messagesEndRef = useRef(null);
  const { currentUser, incrementQuestionCount, questionCount, clearChatHistory } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Audio state
  const [playingIdx, setPlayingIdx] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  // Voice input/output state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem('ttsVoice') || '');
  const [ttsRate, setTtsRate] = useState(parseFloat(localStorage.getItem('ttsRate') || '1'));
  const [ttsPitch, setTtsPitch] = useState(parseFloat(localStorage.getItem('ttsPitch') || '1'));
  const [autoSpeak, setAutoSpeak] = useState(localStorage.getItem('autoSpeak') === 'true');
  const [showVoiceControls, setShowVoiceControls] = useState(false);

  // Check if user is authenticated
  useEffect(() => {
    if (!currentUser) {
      setShowLoginPrompt(true);
    } else {
      setShowLoginPrompt(false);
    }
  }, [currentUser]);

  // Persist language preference
  useEffect(() => {
    const storedLang = localStorage.getItem('chatLanguage');
    if (storedLang) setLanguage(storedLang);
  }, []);
  useEffect(() => {
    localStorage.setItem('chatLanguage', language);
  }, [language]);

  // Load available TTS voices
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis?.getVoices?.() || [];
      setVoices(v);
      // If no selection yet, try default by language
      if (!selectedVoice && v.length) {
        const byLang = v.find(voice => language === 'hindi' ? voice.lang === 'hi-IN' : voice.lang.startsWith('en'));
        if (byLang) setSelectedVoice(byLang.name);
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [language, selectedVoice]);

  // Persist TTS prefs
  useEffect(() => {
    localStorage.setItem('ttsVoice', selectedVoice || '');
  }, [selectedVoice]);
  useEffect(() => {
    localStorage.setItem('ttsRate', String(ttsRate));
  }, [ttsRate]);
  useEffect(() => {
    localStorage.setItem('ttsPitch', String(ttsPitch));
  }, [ttsPitch]);
  useEffect(() => {
    localStorage.setItem('autoSpeak', String(autoSpeak));
  }, [autoSpeak]);

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
      const filtered = JSON.parse(savedMessages).filter(
        msg => msg.role === 'user' || msg.role === 'assistant'
      );
      setMessages(filtered);
    }
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      const filtered = messages.filter(
        msg => msg.role === 'user' || msg.role === 'assistant'
      );
      localStorage.setItem('chatMessages', JSON.stringify(filtered));
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
          setMessages(chat.messages?.filter(
            msg => msg.role === 'user' || msg.role === 'assistant'
          ) || []);
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

  // Enhanced speech synthesis with play/pause and Hindi support + smoother controls
  const handlePlayPause = (text, idx, lang) => {
    if (playingIdx === idx && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } else if (playingIdx === idx && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      const allVoices = window.speechSynthesis.getVoices();
      // Resolve preferred voice
      let voiceToUse = allVoices.find(v => v.name === selectedVoice);
      if (!voiceToUse) {
        voiceToUse = allVoices.find(v => lang === 'hindi' ? v.lang === 'hi-IN' : v.lang.startsWith('en'));
      }
      if (voiceToUse) utterance.voice = voiceToUse;
      utterance.lang = lang === 'hindi' ? 'hi-IN' : (voiceToUse?.lang || 'en-US');
      // Apply smoother parameters
      utterance.rate = Math.max(0.6, Math.min(1.4, ttsRate));
      utterance.pitch = Math.max(0.5, Math.min(1.8, ttsPitch));
      utterance.volume = 1;
      utterance.onend = () => {
        setPlayingIdx(null);
        setIsPaused(false);
      };
      setPlayingIdx(idx);
      setIsPaused(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const speakAssistant = (text) => {
    // Speak without play/pause UI index
    const utterance = new window.SpeechSynthesisUtterance(text);
    const allVoices = window.speechSynthesis.getVoices();
    let voiceToUse = allVoices.find(v => v.name === selectedVoice);
    if (!voiceToUse) {
      voiceToUse = allVoices.find(v => language === 'hindi' ? v.lang === 'hi-IN' : v.lang.startsWith('en'));
    }
    if (voiceToUse) utterance.voice = voiceToUse;
    utterance.lang = language === 'hindi' ? 'hi-IN' : (voiceToUse?.lang || 'en-US');
    utterance.rate = Math.max(0.6, Math.min(1.4, ttsRate));
    utterance.pitch = Math.max(0.5, Math.min(1.8, ttsPitch));
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  // Voice input: Web Speech API SpeechRecognition
  const startListening = () => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return;
      const recog = new SR();
      recog.lang = language === 'hindi' ? 'hi-IN' : 'en-US';
      recog.interimResults = true;
      recog.continuous = false;
      recognitionRef.current = recog;
      setIsListening(true);
      recog.onresult = (event) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript + ' ';
          } else {
            // show interim in input for responsiveness
            setInput(transcript);
          }
        }
        if (finalText.trim()) setInput(prev => (prev ? (prev + ' ' + finalText).trim() : finalText.trim()));
      };
      recog.onerror = () => setIsListening(false);
      recog.onend = () => setIsListening(false);
      recog.start();
    } catch (e) {
      setIsListening(false);
    }
  };
  const stopListening = () => {
    setIsListening(false);
    const recog = recognitionRef.current;
    try { recog && recog.stop(); } catch {}
  };
  const toggleListening = () => {
    if (isListening) stopListening(); else startListening();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!input.trim()) return;
    
    // Check if user is authenticated
    if (!currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    
    if (isHistoryView) return; // Prevent sending in history view

    // Add the user message immediately
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    setIsLoading(true);

    try {
      // Call the actual backend API using the chatService
      const response = await chatService.sendMessage(input, language);

      // Format the response from the backend
      let responseContent;
      if (response.response) {
        responseContent = response.response;
      } else {
        responseContent = typeof response === 'string' ? response : JSON.stringify(response);
      }

      // Only store user and assistant messages (no thinking)
      const assistantMessage = {
        role: 'assistant',
        content: responseContent
      };

      setMessages(prevMessages => [...prevMessages, assistantMessage]);
      if (autoSpeak && typeof window !== 'undefined' && window.speechSynthesis) {
        speakAssistant(responseContent);
      }
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

  const handleLoginRedirect = () => {
    navigate('/login');
  };

  const handleRegisterRedirect = () => {
    navigate('/register');
  };

  // Show login prompt for unauthenticated users
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
          {/* Voice settings toggle */}
          <button
            className="voice-settings"
            onClick={() => setShowVoiceControls(s => !s)}
            title="Voice settings"
          >
            <FaCog />
          </button>
          {/* Microphone input */}
          <button
            className={`mic-button ${isListening ? 'active' : ''}`}
            onClick={toggleListening}
            title={isListening ? 'Stop voice input' : 'Start voice input'}
            type="button"
          >
            {isListening ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
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
        <>
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <img src="/logo3.png" alt="ASK KRISHNA Logo" className="empty-chat-logo" />
                <h2>Welcome to ASK KRISHNA</h2>
                <p>Ask any question about the Bhagavad Gita</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}
                    style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '16px' }}
                  >
                    {/* Play button for assistant messages */}
                    {!isUser && (
                      <button
                        className="listen-btn"
                        title={
                          playingIdx === idx
                            ? isPaused
                              ? 'Resume'
                              : 'Pause'
                            : 'Play'
                        }
                        onClick={() => handlePlayPause(msg.content, idx, language)}
                        style={{
                          marginRight: '10px',
                          cursor: 'pointer',
                          fontSize: '1.5em',
                          background: playingIdx === idx ? '#e0f7fa' : '#f0f0f0',
                          border: 'none',
                          borderRadius: '50%',
                          width: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}
                      >
                        {playingIdx === idx ? (
                          isPaused ? <FaPlay /> : <FaPause />
                        ) : (
                          <FaPlay />
                        )}
                      </button>
                    )}
                    <div
                      className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}
                      style={{
                        maxWidth: '70%',
                        padding: '12px 18px',
                        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isUser ? '#1976d2' : '#f5f5f5',
                        color: isUser ? '#fff' : '#222',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        marginLeft: isUser ? 'auto' : '0',
                        marginRight: isUser ? '0' : 'auto',
                        position: 'relative',
                      }}
                    >
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                );
              })
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
      {showVoiceControls && (
        <div className="voice-controls">
          <div className="control">
            <label>Voice
              <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                <option value="">System default</option>
                {voices
                  .filter(v => language === 'hindi' ? v.lang === 'hi-IN' : v.lang.startsWith('en'))
                  .map(v => (
                    <option key={`${v.name}-${v.lang}`} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
              </select>
            </label>
          </div>
          <div className="control">
            <label>Rate: {ttsRate.toFixed(2)}
              <input type="range" min="0.6" max="1.4" step="0.05" value={ttsRate} onChange={e => setTtsRate(parseFloat(e.target.value))} />
            </label>
          </div>
          <div className="control">
            <label>Pitch: {ttsPitch.toFixed(2)}
              <input type="range" min="0.5" max="1.8" step="0.05" value={ttsPitch} onChange={e => setTtsPitch(parseFloat(e.target.value))} />
            </label>
          </div>
          <div className="control toggle">
            <label>
              <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} /> Auto read replies
            </label>
          </div>
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