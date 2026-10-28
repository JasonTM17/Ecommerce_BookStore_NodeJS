import axios, { AxiosError, AxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

/** The Node.js API preserves the original `/api` contract. */
function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

export const API_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL || "/api",
);

// Global error handler callback
type ErrorHandler = (error: AxiosError) => void;
let globalErrorHandler: ErrorHandler | null = null;

export function setGlobalErrorHandler(handler: ErrorHandler | null) {
  globalErrorHandler = handler;
}

// Retry configuration
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_TIMEOUT_MS = 15000;
const PUBLIC_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_API_TIMEOUT_MS || "65000",
);
const AUTH_COOKIE_PATH = "/";

function isSecureCookieContext() {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

function authCookieOptions(expires: number): Cookies.CookieAttributes {
  return {
    expires,
    path: AUTH_COOKIE_PATH,
    sameSite: "Lax",
    secure: isSecureCookieContext(),
  };
}

function removeAuthCookie(name: string) {
  Cookies.remove(name, { path: AUTH_COOKIE_PATH });
}

function isRetryableError(error: AxiosError): boolean {
  if (!error.config) return false;
  const method = (error.config as AxiosRequestConfig).method?.toUpperCase();
  // Don't retry POST/PUT/DELETE
  if (
    method === "POST" ||
    method === "PUT" ||
    method === "DELETE" ||
    method === "PATCH"
  ) {
    return false;
  }
  // Retry on network errors and 5xx server errors
  if (!error.response) return true;
  return (
    error.response.status >= 500 ||
    error.response.status === 408 ||
    error.response.status === 429
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryRequest(
  config: AxiosRequestConfig,
  retryCount: number,
): Promise<unknown> {
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      return await axios.request(config);
    } catch (error) {
      if (attempt === retryCount || !isRetryableError(error as AxiosError)) {
        throw error;
      }
      await sleep(DEFAULT_RETRY_DELAY * Math.pow(2, attempt));
    }
  }
  throw new Error("Retry exhausted");
}

// Public API instance (no auth headers)
export const apiPublic = axios.create({
  baseURL: API_URL,
  timeout: PUBLIC_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Authenticated API instance
export const api = axios.create({
  baseURL: API_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Retry interceptor for GET requests
apiPublic.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (config && isRetryableError(error) && !config._retry) {
      config._retry = true;
      try {
        return await retryRequest(config, DEFAULT_RETRY_COUNT);
      } catch {
        // Fall through to global error handler
      }
    }
    if (globalErrorHandler) globalErrorHandler(error);
    return Promise.reject(error);
  },
);

// Response interceptor - handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      const refreshToken = Cookies.get("refresh_token");
      if (refreshToken) {
        try {
          const response = await axios.post(
            `${API_URL}/auth/refresh`,
            { refreshToken },
            {
              headers: {
                Authorization: `Bearer ${refreshToken}`,
              },
            },
          );

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          Cookies.set("access_token", accessToken, authCookieOptions(1));
          Cookies.set("refresh_token", newRefreshToken, authCookieOptions(7));

          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${accessToken}`,
          };
          return api(originalRequest);
        } catch {
          // Refresh failed - clear tokens but DON'T redirect if on login page
          removeAuthCookie("access_token");
          removeAuthCookie("refresh_token");
          // Let the component handle the error instead of hard redirecting
        }
      } else {
        // No refresh token - clear and let component handle
        removeAuthCookie("access_token");
        removeAuthCookie("refresh_token");
      }
    }

    // Global error notification for 5xx errors
    if (error.response?.status && error.response.status >= 500) {
      if (globalErrorHandler) globalErrorHandler(error);
    }

    return Promise.reject(error);
  },
);

// Helper to set auth tokens from login/register
export function setAuthTokens(accessToken: string, refreshToken: string) {
  Cookies.set("access_token", accessToken, authCookieOptions(1));
  Cookies.set("refresh_token", refreshToken, authCookieOptions(7));
}

// Helper to clear auth tokens
export function clearAuthTokens() {
  removeAuthCookie("access_token");
  removeAuthCookie("refresh_token");
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  timestamp: number;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}
