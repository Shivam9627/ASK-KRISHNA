import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { authService } from '../services/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  
  // Check if user is already logged in (from localStorage)
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      setCurrentUser(JSON.parse(user));
    }
    
    // Get question count from localStorage
    const count = localStorage.getItem('questionCount');
    if (count) {
      setQuestionCount(parseInt(count));
    }
    
    setLoading(false);
  }, []);
  
  // Function to register a new user
  const register = async (username, email, password) => {
    try {
      setError('');
      const user = await authService.register(username, email, password);
      setCurrentUser(user);
      return user;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register');
      throw err;
    }
  };
  
  // Function to log in a user
  const login = async (email, password) => {
    try {
      setError('');
      const user = await authService.login(email, password);
      setCurrentUser(user);
      setQuestionCount(0); // Reset question count on login
      localStorage.setItem('questionCount', '0');
      return user;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log in');
      throw err;
    }
  };
  
  // Function to log out a user
  const logout = () => {
    localStorage.removeItem('user');
    setCurrentUser(null);
    setQuestionCount(0);
    localStorage.setItem('questionCount', '0');
    // Also clear chat messages from localStorage
    localStorage.removeItem('chatMessages');
  };
  
  // Function to increment question count
  const incrementQuestionCount = () => {
    if (!currentUser) {
      const newCount = questionCount + 1;
      setQuestionCount(newCount);
      localStorage.setItem('questionCount', newCount.toString());
      return newCount;
    }
    return null; // No limit for logged in users
  };
  
  // Function to reset question count
  const resetQuestionCount = () => {
    setQuestionCount(0);
    localStorage.setItem('questionCount', '0');
  };
  
  // Export a function to clear chat history for use in Chat.js
  const clearChatHistory = () => {
    localStorage.removeItem('chatMessages');
    setQuestionCount(0);
    localStorage.setItem('questionCount', '0');
  };
  
  const value = {
    currentUser,
    loading,
    error,
    questionCount,
    register,
    login,
    logout,
    incrementQuestionCount,
    resetQuestionCount,
    clearChatHistory
  };
  
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}