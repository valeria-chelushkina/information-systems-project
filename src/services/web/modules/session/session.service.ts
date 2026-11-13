import { AuthClient } from '@/services/web/clients/auth.client.js';
import { UpstreamError } from '@/services/web/clients/http.client.js';
import { logger } from '@/shared/observability/logger.js';
import type { LoginResult, SessionUser } from '@/services/web/typedefs/api.typedefs.js';

export class SessionService {
  protected readonly auth = new AuthClient();

  login(email: string, password: string): Promise<LoginResult> {
    return this.auth.login(email, password);
  }

  async register(email: string, password: string): Promise<LoginResult> {
    await this.auth.register(email, password);
    return this.auth.login(email, password);
  }

  async logout(token: string): Promise<void> {
    try {
      await this.auth.logout(token);
    } catch (error) {
      logger.warn({ err: error }, 'upstream logout failed');
    }
  }

  async resolve(token: string): Promise<SessionUser | null> {
    try {
      return await this.auth.me(token);
    } catch (error) {
      if (error instanceof UpstreamError && (error.status === 401 || error.status === 403)) {
        return null;
      }

      throw error;
    }
  }
}
