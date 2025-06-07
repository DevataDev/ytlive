import { getSession } from 'next-auth/react';
import { Session } from 'next-auth';
import { configService } from './config';


type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions extends RequestInit {
  token?: string;
  headers?: Record<string, string>;
  noAuth?: boolean; // Skip automatic auth header
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  newStreams: boolean;
  streamUpdates: boolean;
  newsletter: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  showOnlineStatus: boolean;
  allowDirectMessages: 'everyone' | 'friends' | 'none';
  searchEngineIndexing: boolean;
}

interface ThemeSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  reduceAnimations: boolean;
  highContrast: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  error?: string;
  statusCode?: number;
}

export async function apiRequest<T>(
  endpoint: string,
  method: RequestMethod = 'GET',
  data: any = null,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const apiUrl = await getApiUrl(); // instead of process.env.NEXT_PUBLIC_API_URL
  const url = `${apiUrl}${endpoint}`;
  const session = await getSession();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add auth header if not explicitly disabled and token is available
  if (!options.noAuth) {
    const token = options.token || session?.user?.backendToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    method,
    headers,
    credentials: 'include',
    ...options,
  };

  if (data) {
    if (method === 'GET') {
      // Convert data to query string for GET requests
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }
    } else if (data instanceof FormData) {
      // If FormData, let the browser set the Content-Type with boundary
      delete headers['Content-Type'];
      config.body = data;
    } else {
      // For other methods, send as JSON
      config.body = JSON.stringify(data);
    }
  }

  try {
    const response = await fetch(url, config);
    
    // Handle no content
    if (response.status === 204) {
      return { success: true, data: null as unknown as T };
    }

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(responseData.message || 'Something went wrong');
      (error as any).status = response.status;
      (error as any).data = responseData;
      throw error;
    }

    // If the response is already in the ApiResponse format, return it as is
    if (responseData && typeof responseData === 'object' && 'data' in responseData) {
      return responseData as ApiResponse<T>;
    }

    // Otherwise, wrap the response in the standard ApiResponse format
    return {
      data: responseData as T,
      success: true,
      statusCode: response.status
    };
  } catch (error) {
    console.error(`API ${method} ${endpoint} failed:`, error);
    throw error;
  }
}

// Helper methods for common HTTP methods
export const api = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'GET', null, options).then(res => res.data),
  
  post: <T>(endpoint: string, data?: any, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'POST', data, options).then(res => res.data),
  
  put: <T>(endpoint: string, data: any, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'PUT', data, options).then(res => res.data),
  
  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'DELETE', null, options).then(res => res.data),
  
  patch: <T>(endpoint: string, data: any, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'PATCH', data, options).then(res => res.data),
  
  // Raw methods that return the full ApiResponse
  getRaw: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'GET', null, options),
  
  postRaw: <T>(endpoint: string, data?: any, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'POST', data, options),
  
  putRaw: <T>(endpoint: string, data: any, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'PUT', data, options),
  
  deleteRaw: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'DELETE', null, options),
  
  patchRaw: <T>(endpoint: string, data: any, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, 'PATCH', data, options),
};

// Auth API
export const authApi = {
  // Authentication
  login: (credentials: { username: string; password: string; rememberMe?: boolean }) =>
    api.post<{ 
      access_token: string; 
      refresh_token: string;
      user: UserProfile;
      expires_in: number;
    }>('/api/auth/login', credentials, { noAuth: true }),
  
  register: (userData: { 
    username: string; 
    email: string; 
    password: string;
    name?: string;
  }) => api.post<{ user: UserProfile }>('/api/auth/register', userData, { noAuth: true }),
  
  logout: () => api.post('/api/auth/logout'),
  
  // Password Reset
  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }, { noAuth: true }),
  
  resetPassword: (data: { token: string; password: string; email: string }) =>
    api.post('/api/auth/reset-password', data, { noAuth: true }),
  
  validateResetToken: (token: string) =>
    api.get<{ valid: boolean; email?: string }>(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`, { noAuth: true }),
  
  // Profile
  getProfile: () => api.get<{ user: UserProfile }>('/api/auth/me'),
  
  updateProfile: (data: { username?: string; email?: string; name?: string; avatar?: string }) =>
    api.put<{ user: UserProfile }>('/api/auth/me', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/api/auth/change-password', data),
  
  // Token Management
  refreshToken: (refreshToken: string) =>
    api.post<{ 
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>('/api/auth/refresh-token', { refresh_token: refreshToken }, { noAuth: true }),
  
  revokeToken: (token: string) => 
    api.post('/api/auth/revoke-token', { token }),
};

// User Settings API
export const settingsApi = {
  // Notification Settings
  getNotificationSettings: () =>
    api.get<NotificationSettings>('/api/settings/notifications'),
  
  updateNotificationSettings: (settings: Partial<NotificationSettings>) =>
    api.put<NotificationSettings>('/api/settings/notifications', settings),
  
  // Privacy Settings
  getPrivacySettings: () =>
    api.get<PrivacySettings>('/api/settings/privacy'),
  
  updatePrivacySettings: (settings: Partial<PrivacySettings>) =>
    api.put<PrivacySettings>('/api/settings/privacy', settings),
  
  // Theme Settings
  getThemeSettings: () =>
    api.get<ThemeSettings>('/api/settings/theme'),
  
  updateThemeSettings: (settings: Partial<ThemeSettings>) =>
    api.put<ThemeSettings>('/api/settings/theme', settings),
};

// User Management API
export const userApi = {
  // Get user by ID or username
  getUser: (identifier: string) =>
    api.get<{ user: UserProfile }>(`/api/users/${identifier}`),
  
  // Search users
  searchUsers: (query: string, page: number = 1, limit: number = 10) =>
    api.get<{ users: UserProfile[]; total: number; page: number; limit: number }>(
      `/api/users/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    ),
  
  // Update user (admin only)
  updateUser: (userId: string, data: Partial<UserProfile>) =>
    api.put<{ user: UserProfile }>(`/api/users/${userId}`, data),
  
  // Delete user (admin only or self)
  deleteUser: (userId: string) =>
    api.delete(`/api/users/${userId}`),
};

// Replace the direct process.env usage with config service
export async function getApiUrl(): Promise<string> {
  const config = await configService.getConfig();
  return config.apiUrl;
}

export async function getApiBaseUrl(): Promise<string> {
  const config = await configService.getConfig();
  return config.apiBaseUrl;
}
