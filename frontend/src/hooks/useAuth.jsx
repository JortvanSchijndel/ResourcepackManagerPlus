import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config/constants';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState(() => {
    return localStorage.getItem('currentBranch') || 'dev';
  });
  const [isDark, setIsDark] = useState(() => {
    // Check cookie for theme preference
    const match = document.cookie.match(new RegExp('(^| )theme=([^;]+)'));
    if (match) return match[2] === 'dark';
    return true; // Default to dark
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    localStorage.setItem('currentBranch', branch);
  }, [branch]);

  useEffect(() => {
    // Update cookie and DOM when theme changes
    document.cookie = `theme=${isDark ? 'dark' : 'light'}; path=/; max-age=31536000`; // 1 year
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const checkAuth = async () => {
    try {
      // We need to use fetch directly or add a method to api service
      // Assuming api service handles credentials
      const response = await fetch(`${API_URL}/me`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'admin', isDark, setIsDark, branch, setBranch }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);