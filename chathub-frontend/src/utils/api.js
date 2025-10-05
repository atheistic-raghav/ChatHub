import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance (use relative URLs so CRA proxy handles dev traffic)
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for session-based auth (session cookie)
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('chathub_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('chathub_token');
      localStorage.removeItem('chathub_user');
      toast.error('Session expired. Please login again.');
      window.location.href = '/login';
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    }
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  me: () => api.get('/api/auth/me'),
};

// Chat API endpoints
export const chatAPI = {
  getRooms: () => api.get('/api/rooms'),
  getMessages: (roomName) => api.get(`/api/chat/messages/${encodeURIComponent(roomName)}`),
  sendMessage: (roomName, content) => api.post(`/api/chat/messages/${encodeURIComponent(roomName)}`, { content }),
};

// Friends API endpoints
export const friendsAPI = {
  getFriends: () => api.get('/api/friends'),
  sendFriendRequest: (userId) => api.post(`/api/friends/request/${userId}`),
  acceptFriendRequest: (requestId) => api.post(`/api/friends/accept/${requestId}`),
  rejectFriendRequest: (requestId) => api.post(`/api/friends/reject/${requestId}`),
  getPrivateMessages: (friendId) => api.get(`/api/friends/messages/${friendId}`),
  sendPrivateMessage: (friendId, content) => api.post(`/api/friends/messages/${friendId}`, { content }),
};

// Users API endpoints
export const usersAPI = {
  searchUsers: (searchTerm) => api.post('/api/users/search', { search_term: searchTerm }),
};

// Moderation API endpoints
export const modAPI = {
  kick: (username) => api.post('/api/mod/kick', { username }),
  ban: (username) => api.post('/api/mod/ban', { username }),
};

export default api;
