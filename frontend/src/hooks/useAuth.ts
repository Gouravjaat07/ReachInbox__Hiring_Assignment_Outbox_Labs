import { useCallback, useEffect, useState } from 'react';
import { ApiError, authApi } from '../services/api';
import type { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAuth = useCallback(() => {
    setLoading(true);
    setError(null);

    let active = true;
    authApi
      .me()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;

        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          return;
        }

        setError('Authentication service is temporarily unavailable. Please retry.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return refreshAuth();
  }, [refreshAuth]);

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
      setError(null);
      window.location.href = '/login';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log out');
    }
  };

  return {
    user,
    loading,
    error,
    setUser,
    setError,
    refreshAuth,
    logout,
  };
}
