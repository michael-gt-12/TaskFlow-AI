import { IdentityProvider } from './integration.interface';
import { logger } from '../shared/logger';

export class MockIdentityProvider implements IdentityProvider {
  private static linkedUsers = new Map<string, { ssoId: string; providerName: string }>();

  async linkSSOUser(userId: string, ssoId: string, providerName: string): Promise<boolean> {
    logger.info(`[SSO Integration] Linking user ID ${userId} to external provider "${providerName}" ID ${ssoId}`);
    MockIdentityProvider.linkedUsers.set(userId, { ssoId, providerName });
    return true;
  }

  static getLink(userId: string) {
    return this.linkedUsers.get(userId);
  }

  static clearLinks() {
    this.linkedUsers.clear();
  }
}
