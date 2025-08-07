import axios from 'axios';

// Create an axios instance with default config
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include auth token if available
api.interceptors.request.use(
  (config) => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      if (userData.token) {
        config.headers.Authorization = `Bearer ${userData.token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Chat related API calls
const chatService = {
  // Send a message to the chatbot
  sendMessage: async (message, language = 'english') => {
    try {
      // This will connect to the Flask backend
      const response = await api.post('/api/chat', { prompt: message, language });
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },
  
  // Get chat history for a user
  getChatHistory: async () => {
    try {
      const response = await api.get('/api/history');
      return response.data;
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }
  },
  
  // Delete a specific chat from history
  deleteChat: async (chatId) => {
    try {
      const response = await api.delete(`/api/history/${chatId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  },

  // Get a single chat by ID
  getChatById: async (chatId) => {
    try {
      const response = await api.get(`/api/history/${chatId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching chat by ID:', error);
      throw error;
    }
  },
};

// Auth related API calls
const authService = {
  // Register a new user
  register: async (username, email, password) => {
    try {
      const response = await api.post('/api/auth/register', { username, email, password });
      if (response.data && response.data.token) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  },
  
  // Login a user
  login: async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      if (response.data && response.data.token) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  },
  
  // Logout a user
  logout: async () => {
    try {
      const response = await api.post('/api/auth/logout');
      localStorage.removeItem('user');
      return response.data;
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  },
};

export { chatService, authService };