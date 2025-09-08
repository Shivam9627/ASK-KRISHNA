import axios from 'axios';

// Create an axios instance with default config
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? process.env.REACT_APP_BACKEND_URL : undefined,
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
        if (typeof tokenString === 'object' && tokenString !== null) {
          tokenString = JSON.stringify(tokenString);
        }
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
          const repaired = { ...userData, token: validToken };
          localStorage.setItem('user', JSON.stringify(repaired));
        }
        if (userData && userData.user_id) {
          config.headers.Authorization = `Bearer ${userData.user_id}`;
          config.headers['X-User-Id'] = userData.user_id;
          console.log('🔍 Adding headers:', { Authorization: config.headers.Authorization, 'X-User-Id': config.headers['X-User-Id'] });
        }
      } catch (e) {
        console.error('❌ Error parsing user data:', e);
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
  sendMessage: async (message, language = 'english') => {
    try {
      console.log('🔍 Sending message to /api/chat:', { message, language });
      const response = await api.post('/api/chat', { prompt: message, language });
      console.log('✅ Response from /api/chat:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  },
  
  getHistory: async () => {
    try {
      console.log('🔍 Fetching chat history from /api/history');
      const response = await api.get('/api/history');
      console.log('✅ History response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching chat history:', error);
      throw error;
    }
  },
  
  deleteChat: async (chatId) => {
    try {
      console.log('🔍 Deleting chat:', chatId);
      const response = await api.delete(`/api/history/${chatId}`);
      console.log('✅ Chat deleted:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error deleting chat:', error);
      throw error;
    }
  },

  deleteAllHistory: async () => {
    try {
      console.log('🔍 Deleting all chat history');
      const response = await api.delete('/api/history');
      console.log('✅ All chats deleted:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error deleting all chats:', error);
      throw error;
    }
  },

  getChatById: async (chatId) => {
    try {
      console.log('🔍 Fetching chat by ID:', chatId);
      const response = await api.get(`/api/history/${chatId}`);
      console.log('✅ Chat response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching chat by ID:', error);
      throw error;
    }
  },
};

// Auth related API calls
const authService = {
  register: async (username, email, password) => {
    try {
      console.log('🔍 Registering user:', { username, email });
      const response = await api.post('/api/auth/register', { username, email, password });
      if (response.data && response.data.token) {
        localStorage.setItem('user', JSON.stringify(response.data));
        console.log('✅ User registered:', response.data);
      }
      return response.data;
    } catch (error) {
      console.error('❌ Error registering user:', error);
      throw error;
    }
  },
  
  login: async (email, password) => {
    try {
      console.log('🔍 Attempting login with:', { email });
      const response = await api.post('/api/auth/login', { email, password });
      console.log('✅ Login response:', response.data);
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
  
  logout: async () => {
    try {
      console.log('🔍 Logging out');
      const response = await api.post('/api/auth/logout');
      localStorage.removeItem('user');
      console.log('✅ Logged out:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error logging out:', error);
      throw error;
    }
  },

  updateProfile: async (profileData) => {
    try {
      console.log('🔍 Updating profile:', profileData);
      const response = await api.put('/api/auth/profile', profileData);
      console.log('✅ Profile updated:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      throw error;
    }
  },

  getProfile: async () => {
    try {
      console.log('🔍 Fetching profile');
      const response = await api.get('/api/auth/profile');
      console.log('✅ Profile response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      throw error;
    }
  },

  sendRegistrationOTP: async (email) => {
    try {
      console.log('🔍 Sending registration OTP to:', email);
      const response = await api.post('/api/auth/send-registration-otp', { email });
      console.log('✅ OTP sent:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending registration OTP:', error);
      throw error;
    }
  },

  verifyRegistrationOTP: async (email, otp) => {
    try {
      console.log('🔍 Verifying OTP for:', email);
      const response = await api.post('/api/auth/verify-registration-otp', { email, otp });
      console.log('✅ OTP verified:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error verifying registration OTP:', error);
      throw error;
    }
  },

  sendDeleteOTP: async () => {
    try {
      console.log('🔍 Sending delete account OTP');
      const response = await api.post('/api/auth/send-delete-otp');
      console.log('✅ Delete OTP sent:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending delete OTP:', error);
      throw error;
    }
  },

  deleteAccount: async (otp) => {
    try {
      console.log('🔍 Deleting account with OTP');
      const response = await api.delete('/api/auth/account', { data: { otp } });
      console.log('✅ Account deleted:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error deleting account:', error);
      throw error;
    }
  },
};

export { chatService, authService };