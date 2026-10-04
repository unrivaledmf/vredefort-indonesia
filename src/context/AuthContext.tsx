import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.ts';
import { api, getStoredToken, setStoredToken, clearStoredToken } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginGuest: (passcode?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateCurrentUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      clearStoredToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth_unauthorized', handleUnauthorized);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    setStoredToken(res.token);
    setUser(res.user);
  };

  const loginGuest = async (passcode?: string) => {
    const res = await api.loginGuest(passcode);
    setStoredToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
  };

  const updateCurrentUser = (data: Partial<User>) => {
    setUser(prev => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginGuest, logout, refreshUser, updateCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
