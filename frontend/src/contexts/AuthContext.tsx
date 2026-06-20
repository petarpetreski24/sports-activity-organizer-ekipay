import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '../types';
import * as authApi from '../api/auth';
import * as usersApi from '../api/users';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<string>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveTokens = (data: AuthResponse) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
  };

  const refreshUser = async () => {
    try {
      const { data } = await usersApi.getProfile();
      setUser(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      usersApi.getProfile()
        .then(({ data }) => setUser(data))
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password });
    saveTokens(data);
  };

  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    // FR-1.6: registration does not log the user in. They must confirm their
    // email first, so no tokens are stored here.
    const { data } = await authApi.register({ firstName, lastName, email, password });
    return data.email;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'Admin',
      isLoading,
      login, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
