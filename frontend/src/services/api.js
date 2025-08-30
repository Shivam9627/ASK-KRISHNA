import axios from 'axios';

// Create an axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL,
  headers: { 'Content-Type': 'application/json' },
});



// Add a request interceptor to include auth token if available
api.interceptors.request.use(
  (config) => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        let tokenString = userData.token;
        // If token object accidentally stored as object, re-serialize
        if (typeof tokenString === 'object' && tokenString !== null) {
          tokenString = JSON.stringify(tokenString);
        }
        // Validate tokenString is valid JSON; if not, synthesize from known fields
        let validToken = null;
        if (typeof tokenString === 'string' && tokenString.trim().length > 0) {
          try {
            const parsed = JSON.parse(tokenString);
            if (parsed && parsed.user_id) {
              validToken = tokenString;
            }
          } catch (_) {
            // not valid JSON; try to construct
          }
        }
        if (!validToken && userData && userData.user_id) {
          validToken = JSON.stringify({
            user_id: userData.user_id,
            username: userData.username,
            email: userData.email,
            created_at: userData.created_at,
            profileImage: userData.profileImage,
          });
          // persist fixed token to storage
          const repaired = { ...userData, token: validToken };
          localStorage.setItem('user', JSON.stringify(repaired));
        }
        if (validToken) {
          config.headers.Authorization = `Bearer ${validToken}`;
        }
        // Always include X-User-Id as fallback for backend
        if (userData && userData.user_id) {
          config.headers['X-User-Id'] = userData.user_id;
        }
      } catch (e) {
        // ignore malformed localStorage
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

  // Delete all chats for current user
  deleteAllChats: async () => {
    try {
      const response = await api.delete('/api/history');
      return response.data;
    } catch (error) {
      console.error('Error deleting all chats:', error);
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
      console.log("🔍 Attempting login with:", { email, password });
      const response = await api.post('/api/auth/login', { email, password });
      console.log("✅ Login response:", response.data);
      if (response.data && response.data.token) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      console.error('❌ Error logging in:', error);
      console.error('❌ Error response:', error.response?.data);
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

  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await api.put('/api/auth/profile', profileData);
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  // Get current user profile
  getProfile: async () => {
    try {
      const response = await api.get('/api/auth/profile');
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  },

  // Send OTP for registration
  sendRegistrationOTP: async (email) => {
    try {
      const response = await api.post('/api/auth/send-registration-otp', { email });
      return response.data;
    } catch (error) {
      console.error('Error sending registration OTP:', error);
      throw error;
    }
  },

  // Verify OTP for registration
  verifyRegistrationOTP: async (email, otp) => {
    try {
      const response = await api.post('/api/auth/verify-registration-otp', { email, otp });
      return response.data;
    } catch (error) {
      console.error('Error verifying registration OTP:', error);
      throw error;
    }
  },

  // Send OTP for account deletion
  sendDeleteOTP: async () => {
    try {
      const response = await api.post('/api/auth/send-delete-otp');
      return response.data;
    } catch (error) {
      console.error('Error sending delete OTP:', error);
      throw error;
    }
  },

  // Delete account with OTP
  deleteAccount: async (otp) => {
    try {
      const response = await api.delete('/api/auth/account', { data: { otp } });
      return response.data;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  },
};

export { chatService, authService };