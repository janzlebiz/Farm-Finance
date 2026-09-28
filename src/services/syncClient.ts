import {
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse
} from '../types/sync';
import { auth } from './firebase';

export class SyncClient {
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
   */
  static async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `Push sync failed with status ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Dispatches pull request to trusted server boundary (/api/sync/pull)
   */
  static async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/sync/pull', {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `Pull sync failed with status ${res.status}`);
    }

    return await res.json();
  }
}
