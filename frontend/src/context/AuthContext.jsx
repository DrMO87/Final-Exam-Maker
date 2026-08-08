import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('hue_exam_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async (username, password) => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/login', { username, password });

      if (response.data.success) {
        const userData = response.data.user;
        setUser(userData);
        localStorage.setItem('hue_exam_user', JSON.stringify(userData));
        return { success: true };
      } else {
        setError(response.data.error || 'Authentication failed');
        return { success: false, error: response.data.error };
      }
    } catch (err) {
      console.error('Login request error:', err);
      const serverMsg = err.response?.data?.error;
      const statusMsg = err.response?.status === 404 
        ? 'Auth API route missing (404). Please redeploy server.' 
        : 'Invalid credentials or server connection error';
      const msg = serverMsg || statusMsg;
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('hue_exam_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
