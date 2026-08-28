function normalizeApiOrigin(value: string | undefined) {
  if (!value) {
    throw new Error('VITE_API_URL must be set to the backend origin.');
  }

  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('VITE_API_URL must use http or https.');
  }

  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('VITE_API_URL must be a backend origin without a path, query, or credentials.');
  }

  return url.origin;
}

export const API_ORIGIN = normalizeApiOrigin(import.meta.env.VITE_API_URL);
export const API_BASE_URL = new URL('/api', API_ORIGIN).toString();
export const GOOGLE_LOGIN_URL = new URL('/api/auth/google', API_ORIGIN).toString();
