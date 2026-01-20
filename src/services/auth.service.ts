const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE_URL = API_URL;

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
  DEVICE_ID: 'auth_device_id',
};

// Types
export interface RegisterRequest {
  username: string;
  password: string;
  role?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  device_id: string;
  client_type: 'android' | 'ios' | 'web';
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

export interface RefreshRequest {
  refresh_token: string;
  device_id: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  id: number;
  username: string;
  role: string;
}

// Get or create device ID
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  }
  return deviceId;
};

// Get client type
export const getClientType = (): 'android' | 'ios' | 'web' => {
  return 'web';
};

// API call helper
const apiCall = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Auth Service
export const authService = {
  // Register
  register: async (data: RegisterRequest): Promise<{ message: string; user: User }> => {
    return apiCall<{ message: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Login
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const deviceId = getDeviceId();
    const clientType = getClientType();
    
    const loginData: LoginRequest = {
      username,
      password,
      device_id: deviceId,
      client_type: clientType,
    };

    const response = await apiCall<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData),
    });

    // Store tokens and user
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));

    return response;
  },

  // Refresh token
  refreshToken: async (): Promise<RefreshResponse> => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const deviceId = getDeviceId();
    const refreshData: RefreshRequest = {
      refresh_token: refreshToken,
      device_id: deviceId,
    };

    const response = await apiCall<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(refreshData),
    });

    // Update stored tokens
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);

    return response;
  },

  // Logout
  logout: async (): Promise<void> => {
    try {
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        await apiCall('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all auth data
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  },

  // Get stored tokens
  getAccessToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  getUser: (): User | null => {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  },

  // Check if authenticated
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    return !!token;
  },
};

