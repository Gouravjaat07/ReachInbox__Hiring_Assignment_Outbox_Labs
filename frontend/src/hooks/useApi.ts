import { useState } from 'react';

export function useApi<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  return {
    loading,
    error,
    data,
    setLoading,
    setError,
    setData,
  };
}
