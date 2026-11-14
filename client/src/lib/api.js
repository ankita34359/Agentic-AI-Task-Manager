// Thin fetch wrapper: JSON in/out, Bearer token from localStorage, typed errors.
const KEY = 'ol-token';

// localStorage can throw (private mode, blocked storage) — the app then simply works for this tab only.
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || 'error');
    this.status = status;
    this.code = body?.error || 'error';
    this.fields = body?.fields || {};
    this.body = body || {};
  }
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, { error: 'network' });
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    // An expired/invalid session anywhere in the app logs the user out (AuthContext listens).
    if (res.status === 401 && token) window.dispatchEvent(new Event('ol:unauthorized'));
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
};
