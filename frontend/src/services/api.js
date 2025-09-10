import axios from 'axios';

// Create an axios instance with default config
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? process.env.REACT_APP_BACKEND_URL 
    : 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000, // 60s timeout to handle slow backend
});

// Add a request interceptor to include auth token and user ID
api.interceptors.request.use(
  (config) => {
    console.log('🔍 Base URL:', api.defaults.baseURL); // Debug URL
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        let token = userData.token;
        const userId = userData.user_id;

        // Ensure token is a string
        if (typeof token === 'object' && token !== null) {
          token = JSON.stringify(token);
        }

        // Validate and repair token if necessary
        let validToken = null;
        if (typeof token === 'string' && token.trim().length > 0) {
          try {
            const parsed = JSON.parse(token);
            if (parsed && parsed.user_id) {
              validToken = token;
            }
          } catch (e) {
            console.warn('⚠️ Token is not valid JSON:', e);
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
          console.log('🔧 Repaired user token in localStorage');
        }

        if (userId) {
          config.headers.Authorization = `Bearer ${validToken || userId}`;
          config.headers['X-User-Id'] = userId;
          console.log('🔍 Adding headers:', {
            Authorization: config.headers.Authorization,
            'X-User-Id': config.headers['X-User-Id'],
          });
        } else {
          console.warn('⚠️ No user_id found in user data');
        }
      } catch (e) {
        console.error('❌ Error parsing user data:', e);
      }
    } else {
      console.warn('⚠️ No user data in localStorage');
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor with retries for HTTP/2 errors
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Response from ${response.config.url}:`, {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  async (error) => {
    const maxRetries = 3;
    const retryDelay = 2000; // 2s base delay
    const config = error.config;

    // Log full error details
    console.error('❌ API Response Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
      url: config?.url,
      stack: error.stack,
    });

    // Retry for HTTP/2 errors or network issues
    if (
      (error.code === 'ERR_NETWORK' || error.message.includes('ERR_HTTP2')) &&
      !config._retryCount
    ) {
      config._retryCount = config._retryCount || 0;
      if (config._retryCount < maxRetries) {
        config._retryCount++;
        console.log(
          `🔄 Retrying request (${config._retryCount}/${maxRetries}) to ${config.url}...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * config._retryCount)
        );
        return api(config); // Retry the request
      }
    }

    return Promise.reject(error);
  }
);

// Chat related API calls
const chatService = {
  sendMessage: async (message, language = 'english') => {
    try {
      console.log('🔍 Sending message to /api/chat:', { prompt: message, language });
      const response = await api.post('/api/chat', { prompt: message, language });
      console.log('✅ Response from /api/chat:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending message:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
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
      console.error('❌ Error fetching chat history:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
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
      console.error('❌ Error deleting chat:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
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
      console.error('❌ Error deleting all chats:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
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
      console.error('❌ Error fetching chat by ID:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
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
      console.log('✅ Register response:', response.data);
      if (response.data && response.data.token) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      console.error('❌ Error registering user:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
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
      console.error('❌ Error logging in:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      console.log('🔍 Logging out');
      const response = await api.post('/api/auth/logout');
      console.log('✅ Logout response:', response.data);
      localStorage.removeItem('user');
      return response.data;
    } catch (error) {
      console.error('❌ Error logging out:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  },

  updateProfile: async (profileData) => {
    try {
      console.log('🔍 Updating profile:', profileData);
      const response = await api.put('/api/auth/profile', profileData);
      console.log('✅ Profile update response:', response.data);
      if (response.data && response.data.token) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      console.error('❌ Error updating profile:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
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
      console.error('❌ Error fetching profile:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  },

  sendRegistrationOTP: async (email) => {
    try {
      console.log('🔍 Sending registration OTP for:', email);
      const response = await api.post('/api/auth/send-registration-otp', { email });
      console.log('✅ OTP send response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending registration OTP:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  },

  verifyRegistrationOTP: async (email, otp) => {
    try {
      console.log('🔍 Verifying registration OTP for:', email);
      const response = await api.post('/api/auth/verify-registration-otp', { email, otp });
      console.log('✅ OTP verify response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error verifying registration OTP:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  },

  sendDeleteOTP: async () => {
    try {
      console.log('🔍 Sending delete account OTP');
      const response = await api.post('/api/auth/send-delete-otp');
      console.log('✅ Delete OTP send response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending delete OTP:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  },

  deleteAccount: async (otp) => {
    try {
      console.log('🔍 Deleting account with OTP');
      const response = await api.delete('/api/auth/account', { data: { otp } });
      console.log('✅ Account delete response:', response.data);
      localStorage.removeItem('user');
      return response.data;
    } catch (error) {
      console.error('❌ Error deleting account:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  },
};

export { chatService, authService };