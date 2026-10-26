import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  canViewModule as checkCanViewModule,
  canViewPage as checkCanViewPage,
  canViewTab as checkCanViewTab,
  canPerformAction as checkCanPerformAction,
  canViewField as checkCanViewField,
  canAccessRecord as checkCanAccessRecord
} from '../services/permissionService';

export interface UserProfile {
  id: string;
  companyId: string;
  companyName: string;
  companyBrand: string;
  institutionBrand?: string;
  companyCode?: string;
  username: string;
  fullName: string;
  email: string;
  roles: string[];
  primaryRole: string;
  permissions?: string[];
  employeeId?: string | null;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    workEmail?: string | null;
    departmentId?: string;
    branchId?: string;
    designationId?: string;
  } | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  canViewModule: (moduleKey: string) => boolean;
  canViewPage: (pageKey: string) => boolean;
  canViewTab: (tabKey: string) => boolean;
  canPerformAction: (actionKey: string) => boolean;
  canViewField: (fieldKey: string) => boolean;
  canAccessRecord: (record: { companyId?: string }) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('pm_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('pm_auth_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifySession = async () => {
      const savedToken = localStorage.getItem('pm_auth_token');
      if (savedToken) {
        try {
          const res: any = await api.get('/auth/me');
          setUser(res.user);
          localStorage.setItem('pm_auth_user', JSON.stringify(res.user));
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };

    verifySession();

    const handleUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = (newToken: string, newUser: UserProfile) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('pm_auth_token', newToken);
    localStorage.setItem('pm_auth_user', JSON.stringify(newUser));
  };

  const logout = async () => {
    try {
      const currentToken = localStorage.getItem('pm_auth_token');
      if (currentToken) {
        await api.post('/auth/logout');
      }
    } catch {
      // Ignore network/authorization errors on logout
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('pm_auth_token');
      localStorage.removeItem('pm_auth_user');
    }
  };

  const hasRole = (roles: string[]) => {
    if (!user) return false;
    if (user.roles.includes('company_admin') || user.roles.includes('platform_admin')) return true;
    return user.roles.some(r => roles.includes(r));
  };

  const canViewModule = (moduleKey: string) => checkCanViewModule(moduleKey, user);
  const canViewPage = (pageKey: string) => checkCanViewPage(pageKey, user);
  const canViewTab = (tabKey: string) => checkCanViewTab(tabKey, user);
  const canPerformAction = (actionKey: string) => checkCanPerformAction(actionKey, user);
  const canViewField = (fieldKey: string) => checkCanViewField(fieldKey, user);
  const canAccessRecord = (record: { companyId?: string }) => checkCanAccessRecord(record, user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        hasRole,
        canViewModule,
        canViewPage,
        canViewTab,
        canPerformAction,
        canViewField,
        canAccessRecord
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
