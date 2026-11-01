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

      // Dynamic real-time role & permission syncing
      const handleFocus = () => reloadUser();
      window.addEventListener('focus', handleFocus);
      const pollInterval = setInterval(() => reloadUser(), 15000);

      return () => {
        window.removeEventListener('focus', handleFocus);
        clearInterval(pollInterval);
      };
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

  const logout = () => {
    localStorage.removeItem('asar_token');
    setToken(null);
    setUser(null);
  };

  // RBAC Permission checks
  const isOwner = user?.role === 'owner';
  const isDirector = user?.role === 'director';
  const isAdmin = user?.role === 'admin';
  const isSpecialist = user?.role === 'specialist';

  const canAccessAccounting = user && ['owner', 'director', 'admin'].includes(user.role);
  const canManageSchedule = user && ['owner', 'director', 'admin'].includes(user.role);
  const canEditChildren = user && ['owner', 'director', 'admin'].includes(user.role);
  const canManageUsers = user && ['owner', 'director', 'admin'].includes(user.role);
  const canChangeUserRoles = user && ['owner', 'director'].includes(user.role);
  const canManagePayroll = user && ['owner', 'director'].includes(user.role);
  const canUseAi = user && ['owner', 'director', 'admin'].includes(user.role);

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
        logout,
        isOwner,
        isDirector,
        isAdmin,
        isSpecialist,
        canAccessAccounting,
        canManageSchedule,
        canEditChildren,
        canManageUsers,
        canChangeUserRoles,
        canManagePayroll,
        canUseAi
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
