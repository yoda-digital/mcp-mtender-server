import axios from "axios";
import { logger } from "../utils/logger.js";

// Base URL for the MTender API
export const MTENDER_API_BASE_URL = "https://public.mtender.gov.md";

// Define custom error type with code property
interface AxiosErrorWithCode extends Error {
  code?: string;
  response?: any;
  config?: any;
}

// Add request metadata to track timing
type RequestMetadata = {
  startTime: number;
};

// Create axios instance with logging interceptors
export const axiosInstance = axios.create({
  baseURL: MTENDER_API_BASE_URL,
  timeout: 30000, // 30 second timeout
});

// Add request interceptor for logging
axiosInstance.interceptors.request.use(
  (config) => {
    // Get headers and ensure they exist
    const headers = config.headers || {};
    const requestId = (headers['X-Request-ID'] as string) || `axios-${Date.now()}`;
    
    // Set the request ID header
    if (headers.set) {
      // For AxiosHeaders (newer versions)
      headers.set('X-Request-ID', requestId);
    } else {
      // Fallback for older versions or custom headers
      headers['X-Request-ID'] = requestId;
    }
    
    logger.debug(`Axios request: ${config.method?.toUpperCase()} ${config.url}`, {
      requestId,
      method: config.method,
      url: config.url,
      params: config.params,
      headers: {
        ...Object.fromEntries(
          Object.entries(headers).filter(([key]) => typeof key === 'string')
        ),
        Authorization: '[REDACTED]'
      }
    });
    
    // Store timing metadata
    const metadata: RequestMetadata = { startTime: Date.now() };
    
    // Attach metadata to config without modifying its type
    (config as any)._metadata = metadata;
    
    return config;
  },
  (error) => {
    logger.error(`Axios request error`, {
      message: error.message,
      stack: error.stack
    });
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
axiosInstance.interceptors.response.use(
  (response) => {
    // Retrieve metadata safely
    const metadata = (response.config as any)._metadata as RequestMetadata | undefined;
    const startTime = metadata?.startTime || Date.now();
    const duration = Date.now() - startTime;
    
    // Get request ID from headers
    const headers = response.config.headers || {};
    const requestId = (headers['X-Request-ID'] as string) || 'unknown';
    
    logger.debug(`Axios response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      requestId,
      status: response.status,
      statusText: response.statusText,
      duration,
      dataSize: JSON.stringify(response.data).length,
      headers: response.headers
    });
    
    return response;
  },
  (error: AxiosErrorWithCode) => {
    // Safely extract config and metadata
    const config = error.config || {};
    const metadata = (config as any)?._metadata as RequestMetadata | undefined;
    const startTime = metadata?.startTime || Date.now();
    const duration = Date.now() - startTime;
    
    // Get request ID from headers
    const headers = config.headers || {};
    const requestId = (headers['X-Request-ID'] as string) || 'unknown';
    
    logger.error(`Axios response error`, {
      requestId,
      message: error.message,
      errorCode: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      duration,
      data: error.response?.data,
      headers: error.response?.headers,
      stack: error.stack
    });
    
    return Promise.reject(error);
  }
);