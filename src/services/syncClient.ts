import {
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse
} from '../types/sync';
import { auth } from './firebase';

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

  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (_) {}
    }
    return headers;
  }

  /**
   * Dispatches push request to trusted server boundary (/api/sync/push)
   * Includes 15-second request timeout and network resilience.
   */
  static async push(request: SyncPushRequest, timeoutMs = 15000): Promise<SyncPushResponse> {
    const headers = await this.getAuthHeaders();
    const baseUrl = getSyncApiBaseUrl();
    const endpoint = `${baseUrl}/api/sync/push`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `Push sync failed with HTTP status ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Push sync timed out after ${timeoutMs}ms. Server is unreachable.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Dispatches pull request to trusted server boundary (/api/sync/pull)
   * Includes 15-second request timeout and network resilience.
   */
  static async pull(request: SyncPullRequest, timeoutMs = 15000): Promise<SyncPullResponse> {
    const headers = await this.getAuthHeaders();
    const baseUrl = getSyncApiBaseUrl();
    const endpoint = `${baseUrl}/api/sync/pull`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `Pull sync failed with HTTP status ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Pull sync timed out after ${timeoutMs}ms. Server is unreachable.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
