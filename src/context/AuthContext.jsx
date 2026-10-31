import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('asar_token') || null);
  const [loading, setLoading] = useState(true);

  // Load current user profile if token exists
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Token expired or unauthorized');
          return res.json();
        })
        .then(data => {
          setUser(data.user);
          setLoading(false);
        })
        .catch(err => {
          console.warn('Authentication token invalid, resetting session', err);
          localStorage.removeItem('asar_token');
          setToken(null);
          setUser(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (loginId, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginId, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка авторизации');
    
    localStorage.setItem('asar_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (formData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
    return data;
  };

  const sendVerificationCode = async (target, purpose = 'register') => {
    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, purpose })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка отправки кода');
    return data;
  };

  const resetPassword = async (payload) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка сброса пароля');
    return data;
  };

  const updateProfile = async (profileData) => {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка обновления профиля');

    if (data.token) {
      localStorage.setItem('asar_token', data.token);
      setToken(data.token);
    }
    if (data.user) {
      setUser(data.user);
    }
    return data;
  };

  const reloadUser = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {}
  };

  const switchRole = async (role) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('asar_token', data.token);
        setToken(data.token);
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to switch role', err);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('asar_token');
    setToken(null);
    setUser(null);
  };

  // RBAC Permission checks
  const canAccessAccounting = user && ['owner', 'director', 'admin'].includes(user.role);
  const canManageSchedule = user && ['owner', 'director', 'admin'].includes(user.role);
  const canEditChildren = user && ['owner', 'director', 'admin'].includes(user.role);
  const canManageUsers = user && ['owner', 'director'].includes(user.role);
  const canManagePayroll = user && ['owner', 'director'].includes(user.role);
  const canUseAi = user && ['owner', 'director', 'admin'].includes(user.role);
  const isSpecialist = user && user.role === 'specialist';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        sendVerificationCode,
        resetPassword,
        updateProfile,
        reloadUser,
        switchRole,
        logout,
        canAccessAccounting,
        canManageSchedule,
        canEditChildren,
        canManageUsers,
        canManagePayroll,
        canUseAi,
        isSpecialist
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
