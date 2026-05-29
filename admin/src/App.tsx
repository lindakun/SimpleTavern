import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { apiRequest } from './api/client';
import Login from './pages/Login';
import Layout from './pages/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Characters from './pages/Characters';
import Worlds from './pages/Worlds';

export default function App() {
  const [auth, setAuth] = useState<{
    loading: boolean;
    handle: string | null;
    isAdmin: boolean;
  }>({ loading: true, handle: null, isAdmin: false });

  const checkAuth = useCallback(() => {
    setAuth({ loading: true, handle: null, isAdmin: false });
    apiRequest<{ handle: string; admin: boolean }>('/api/users/me')
      .then((data) => {
        setAuth({ loading: false, handle: data.handle, isAdmin: data.admin });
      })
      .catch(() => {
        setAuth({ loading: false, handle: null, isAdmin: false });
      });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLoginSuccess = useCallback(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = useCallback(() => {
    setAuth({ loading: false, handle: null, isAdmin: false });
  }, []);

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-background-deep flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-pink animate-bounce" />
          <div className="w-2 h-2 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '0.15s' }} />
          <div className="w-2 h-2 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    );
  }

  // 未登录或非管理员 → 登录页
  if (!auth.handle || !auth.isAdmin) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 已登录管理员 → 管理面板
  return (
    <Layout handle={auth.handle} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/characters" element={<Characters />} />
        <Route path="/worlds" element={<Worlds />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
