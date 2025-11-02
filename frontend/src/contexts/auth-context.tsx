'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('auth_token'); // FIXED
        if (token) {
          const userData = await authApi.getProfile() as User;
          setUser(userData);
        }
      } catch (error) {
        console.error('Failed to load user', error);
        localStorage.removeItem('auth_token');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { access_token, user } = await authApi.login(email, password);

      localStorage.setItem('auth_token', access_token);

      setUser(user);
      return user; // Optional but useful
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Invalid email or password";

      // Re-throw so LoginPage can catch it
      throw new Error(message);
    }
  };


  const register = async (name: string, email: string, password: string) => {
    await authApi.register(name, email, password);
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('auth_token'); // FIXED
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN',
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
