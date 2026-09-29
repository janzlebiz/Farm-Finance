import {
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse
} from '../types/sync';
import { getFirebaseAuth } from './firebase';

let customBaseUrl: string | null = null;

function getSyncApiBaseUrl(): string {
  if (customBaseUrl !== null) {
    return customBaseUrl;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SYNC_API_BASE_URL) {
    return (import.meta.env.VITE_SYNC_API_BASE_URL as string).replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && (window as any).__SYNC_API_BASE_URL__) {
    return (window as any).__SYNC_API_BASE_URL__.replace(/\/+$/, '');
  }
  return '';
}

export class SyncClient {
  /**
   * Sets custom base URL for standalone Android APK or remote hosting
   */
  static setBaseUrl(url: string | null): void {
    customBaseUrl = url ? url.replace(/\/+$/, '') : null;
  }

  /**
   * Gets the currently configured base URL
   */
  static getBaseUrl(): string {
    return getSyncApiBaseUrl();
  }

  private static logDiagnostic(type: string, details: any) {
    console.log(`[SYNC_DIAGNOSTIC][${type}]`, JSON.stringify({
      origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
      baseUrl: getSyncApiBaseUrl(),
      timestamp: new Date().toISOString(),
      navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown',
      ...details
    }));
  }

  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const auth = getFirebaseAuth();
    if (auth && auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (err: any) {
        this.logDiagnostic('AUTH_TOKEN_ERROR', { error: err.message });
        throw new Error(`AUTH_TOKEN_ERROR: ${err.message}`);
      }
    }
    return headers;
  }

  static async push(request: SyncPushRequest, timeoutMs = 15000): Promise<SyncPushResponse> {
    const start = Date.now();
    const endpoint = `${getSyncApiBaseUrl()}/api/sync/push`;
    
    try {
      const headers = await this.getAuthHeaders();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(request),
          signal: controller.signal
        });

        const duration = Date.now() - start;
        const contentType = res.headers.get('content-type');

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          this.logDiagnostic('HTTP_ERROR', { 
            status: res.status, 
            endpoint, 
            duration,
            error: errBody.error 
          });
          
          if (res.status === 401) throw new Error(`HTTP_401: POST ${endpoint}`);
          if (res.status >= 500) throw new Error(`HTTP_5XX: POST ${endpoint} :: ${res.status}`);
          throw new Error(`HTTP_4XX: POST ${endpoint} :: ${res.status}`);
        }

        return await res.json();
      } catch (err: any) {
        if (err.name === 'AbortError') throw new Error(`PUSH_TIMEOUT: POST ${endpoint}`);
        if (err.message.startsWith('HTTP_')) throw err;
        
        this.logDiagnostic('NETWORK_FETCH_ERROR', { endpoint, error: err.message });
        throw new Error(`NETWORK_FETCH_ERROR: POST ${endpoint} :: ${err.message}`);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      if (err.message.includes('AUTH_TOKEN_ERROR')) throw err;
      throw err;
    }
  }

  /**
   * Dispatches pull request to trusted server boundary (/api/sync/pull)
   * Includes 15-second request timeout and network resilience.
   */
  static async pull(request: SyncPullRequest, timeoutMs = 15000): Promise<SyncPullResponse> {
    const start = Date.now();
    const endpoint = `${getSyncApiBaseUrl()}/api/sync/pull`;
    
    try {
      const headers = await this.getAuthHeaders();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(request),
          signal: controller.signal
        });

        const duration = Date.now() - start;

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          this.logDiagnostic('HTTP_ERROR', { 
            status: res.status, 
            endpoint, 
            duration,
            error: errBody.error 
          });
          
          if (res.status === 401) throw new Error(`HTTP_401: POST ${endpoint}`);
          if (res.status >= 500) throw new Error(`HTTP_5XX: POST ${endpoint} :: ${res.status}`);
          throw new Error(`HTTP_4XX: POST ${endpoint} :: ${res.status}`);
        }

        return await res.json();
      } catch (err: any) {
        if (err.name === 'AbortError') throw new Error(`PULL_TIMEOUT: POST ${endpoint}`);
        if (err.message.startsWith('HTTP_')) throw err;
        
        this.logDiagnostic('NETWORK_FETCH_ERROR', { endpoint, error: err.message });
        throw new Error(`NETWORK_FETCH_ERROR: POST ${endpoint} :: ${err.message}`);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      if (err.message.includes('AUTH_TOKEN_ERROR')) throw err;
      throw err;
    }
  }
}
