// Centralized Real-API Client for Nuraiyan Social Network
// Handles authentication headers, tokens, and cross-domain hosting seamlessly

const getBaseApiUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl !== 'http://127.0.0.1:5001' && envUrl !== 'http://localhost:5001') {
    return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
  }

  if (typeof window !== 'undefined') {
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.');

    if (isLocal) {
      const port = '5001';
      const hostname = window.location.hostname || 'localhost';
      return `${window.location.protocol}//${hostname}:${port}/api`;
    }

    // When deployed online on a domain or cloud provider (e.g. Vercel, Railway, Render)
    if (envUrl) {
      return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
    }
  }

  const raw = envUrl || 'http://127.0.0.1:5001';
  return raw.endsWith('/api') ? raw : `${raw.replace(/\/$/, '')}/api`;
};

export const API_BASE_URL = getBaseApiUrl();

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  url?: string;
  urls?: string[];
  errors?: Record<string, string[]>;
  [key: string]: any;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = typeof window !== 'undefined' ? getBaseApiUrl() : API_BASE_URL;
  const url = `${baseUrl}${cleanEndpoint}`;

  const token = typeof window !== 'undefined' ? localStorage.getItem('nuraiyan_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && token !== 'undefined' && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers,
      credentials: 'include', // for HttpOnly cookies
    });

    // Auto-cache fresh token returned by backend
    const freshToken = response.headers.get('x-access-token');
    if (freshToken && typeof window !== 'undefined') {
      localStorage.setItem('nuraiyan_token', freshToken);
    }

    const data = await response.json().catch(() => ({
      success: false,
      message: 'Invalid server response format.',
    }));

    if (data.data?.accessToken && typeof window !== 'undefined') {
      localStorage.setItem('nuraiyan_token', data.data.accessToken);
    }

    return { ...data, status: response.status };
  } catch (error: any) {
    console.warn(`[API Network Notice: ${cleanEndpoint}]`, error.message);
    return {
      success: false,
      status: 0, // 0 = network/connection failure
      message: 'Could not connect to server. Please check your network connection.',
    };
  }
}

export const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const baseUrl = typeof window !== 'undefined' ? getBaseApiUrl() : API_BASE_URL;
  const base = baseUrl.replace(/\/api$/, '').replace(/\/$/, '');
  return `${base}${cleanPath}`;
};

export const api = {
  get: <T = any>(endpoint: string) => apiRequest<T>(endpoint, { method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = any>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' }),
  upload: async <T = any>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const baseUrl = typeof window !== 'undefined' ? getBaseApiUrl() : API_BASE_URL;
    const url = `${baseUrl}${cleanEndpoint}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('nuraiyan_token') : null;

    const headers: Record<string, string> = {};
    if (token && token !== 'undefined' && token !== 'null') {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });

      const freshToken = response.headers.get('x-access-token');
      if (freshToken && typeof window !== 'undefined') {
        localStorage.setItem('nuraiyan_token', freshToken);
      }

      const data = await response.json().catch(() => ({
        success: false,
        message: 'Invalid server response format.',
      }));

      return { ...data, status: response.status };
    } catch (err: any) {
      console.error('[Upload error]', err);
      return {
        success: false,
        status: 0,
        message: 'File upload failed. Unable to reach upload server.',
      };
    }
  },
  uploadWithProgress: <T = any>(
    endpoint: string,
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<ApiResponse<T>> => {
    return new Promise((resolve) => {
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const baseUrl = typeof window !== 'undefined' ? getBaseApiUrl() : API_BASE_URL;
      const url = `${baseUrl}${cleanEndpoint}`;
      const token = typeof window !== 'undefined' ? localStorage.getItem('nuraiyan_token') : null;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.withCredentials = true;

      if (token && token !== 'undefined' && token !== 'null') {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        const freshToken = xhr.getResponseHeader('x-access-token');
        if (freshToken && typeof window !== 'undefined') {
          localStorage.setItem('nuraiyan_token', freshToken);
        }

        try {
          const json = JSON.parse(xhr.responseText);
          resolve({ ...json, status: xhr.status });
        } catch {
          resolve({
            success: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            message: xhr.statusText,
          });
        }
      };

      xhr.onerror = () => {
        resolve({
          success: false,
          status: 0,
          message: 'Network error occurred during upload.',
        });
      };

      xhr.send(formData);
    });
  },
};

