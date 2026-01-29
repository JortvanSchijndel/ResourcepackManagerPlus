import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config/constants';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState(() => {
    return localStorage.getItem('currentBranch') || 'dev';
  });
  
  // 'light', 'dark', or 'system'
  const [themePreference, setThemePreference] = useState(() => {
    const match = document.cookie.match(new RegExp('(^| )theme=([^;]+)'));
    if (match) {
        const val = match[2];
        if (val === 'light' || val === 'dark' || val === 'system') return val;
    }
    return 'system'; 
  });

  // Derived state for actual display
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    localStorage.setItem('currentBranch', branch);
  }, [branch]);

  useEffect(() => {
    const applyTheme = () => {
      let effectiveDark = false;
      if (themePreference === 'system') {
        effectiveDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        effectiveDark = themePreference === 'dark';
      }
      
      setIsDark(effectiveDark);

      if (effectiveDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      document.cookie = `theme=${themePreference}; path=/; max-age=31536000`; // 1 year
    };

    applyTheme();

    // Listen for system changes if preference is system
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (themePreference === 'system') {
            applyTheme();
        }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);

  }, [themePreference]);

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
    <AuthContext.Provider value={{ 
        user, 
        login, 
        logout, 
        loading, 
        isAdmin: user?.role === 'admin', 
        isDark, // Actual applied theme (boolean)
        themePreference, // 'light', 'dark', 'system'
        setThemePreference, 
        branch, 
        setBranch 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);