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
    return customBaseUrl.trim().replace(/\/+$/, '');
  }
  
  // In the AI Studio web preview, we MUST use relative paths to avoid CORS and domain typos.
  // We only use absolute URLs if VITE_ANDROID_EMBEDDED is true (for the standalone APK).
  const isAndroidEmbedded = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANDROID_EMBEDDED === 'true') ||
    (typeof process !== 'undefined' && process.env?.VITE_ANDROID_EMBEDDED === 'true');
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SYNC_API_BASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SYNC_API_BASE_URL);

  if (isAndroidEmbedded && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  
  // Default to relative path in web browser to use the current origin
  return '';
}

export class SyncClient {
  /**
   * Sets custom base URL for standalone Android APK or remote hosting
   */
  static setBaseUrl(url: string | null): void {
    customBaseUrl = url ? url.trim().replace(/\/+$/, '') : null;
    console.log(`[SyncClient] Custom Base URL set to: ${customBaseUrl || 'RELATIVE'}`);
  }

  /**
   * Gets the currently configured base URL
   */
  static getBaseUrl(): string {
    return getSyncApiBaseUrl();
  }

  private static logDiagnostic(type: string, details: any) {
    const baseUrl = getSyncApiBaseUrl();
    console.log(`[SYNC_DIAGNOSTIC][${type}]`, JSON.stringify({
      origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
      baseUrl,
      resolvedBaseUrl: baseUrl || '(relative)',
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
    const isNativeAvailable = typeof window !== 'undefined' && 
      Boolean((window as any).FarmFinanceNative?.nativeSyncPush);

    if (isNativeAvailable) {
      const auth = getFirebaseAuth();
      if (!auth || !auth.currentUser) {
        throw new Error('AUTH_TOKEN_ERROR: User is not authenticated.');
      }

      const token = await auth.currentUser.getIdToken(true);
      const rawRes = (window as any).FarmFinanceNative.nativeSyncPush(token, JSON.stringify(request));
      let res: { success: boolean; status: number; body: string; error?: string };
      try {
        res = JSON.parse(rawRes);
      } catch {
        throw new Error(`NETWORK_FETCH_ERROR: POST /api/sync/push :: Invalid JSON from native bridge`);
      }

      if (res.status === 401) throw new Error(`HTTP_401: POST /api/sync/push`);
      if (res.status >= 500) throw new Error(`HTTP_5XX: POST /api/sync/push :: ${res.status}`);
      if (res.status >= 400) throw new Error(`HTTP_4XX: POST /api/sync/push :: ${res.status}`);
      if (!res.success) {
        throw new Error(`NETWORK_FETCH_ERROR: POST /api/sync/push :: ${res.error || 'Native request failed'}`);
      }

      try {
        return JSON.parse(res.body) as SyncPushResponse;
      } catch {
        throw new Error(`NETWORK_FETCH_ERROR: POST /api/sync/push :: Failed to parse server response body`);
      }
    }

    const start = Date.now();
    const baseUrl = getSyncApiBaseUrl();
    const endpoint = `${baseUrl}/api/sync/push`;
    
    console.log(`[SyncClient] PUSH Request to: ${endpoint || '(relative)/api/sync/push'}`);
    
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
    const isNativeAvailable = typeof window !== 'undefined' && 
      Boolean((window as any).FarmFinanceNative?.nativeSyncPull);

    if (isNativeAvailable) {
      const auth = getFirebaseAuth();
      if (!auth || !auth.currentUser) {
        throw new Error('AUTH_TOKEN_ERROR: User is not authenticated.');
      }

      const token = await auth.currentUser.getIdToken(true);
      const rawRes = (window as any).FarmFinanceNative.nativeSyncPull(token, JSON.stringify(request));
      let res: { success: boolean; status: number; body: string; error?: string };
      try {
        res = JSON.parse(rawRes);
      } catch {
        throw new Error(`NETWORK_FETCH_ERROR: POST /api/sync/pull :: Invalid JSON from native bridge`);
      }

      if (res.status === 401) throw new Error(`HTTP_401: POST /api/sync/pull`);
      if (res.status >= 500) throw new Error(`HTTP_5XX: POST /api/sync/pull :: ${res.status}`);
      if (res.status >= 400) throw new Error(`HTTP_4XX: POST /api/sync/pull :: ${res.status}`);
      if (!res.success) {
        throw new Error(`NETWORK_FETCH_ERROR: POST /api/sync/pull :: ${res.error || 'Native request failed'}`);
      }

      try {
        return JSON.parse(res.body) as SyncPullResponse;
      } catch {
        throw new Error(`NETWORK_FETCH_ERROR: POST /api/sync/pull :: Failed to parse server response body`);
      }
    }

    const start = Date.now();
    const baseUrl = getSyncApiBaseUrl();
    const endpoint = `${baseUrl}/api/sync/pull`;
    
    console.log(`[SyncClient] PULL Request to: ${endpoint || '(relative)/api/sync/pull'}`);
    
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
