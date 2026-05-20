import { EmailProvider, EmailPayload } from './integration.interface';
import { logger } from '../shared/logger';

export class MockEmailProvider implements EmailProvider {
  private static sentEmails: EmailPayload[] = [];

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    logger.info(`[Email Integration] Mock sending email to ${payload.to} with subject "${payload.subject}"`);
    await new Promise(r => setTimeout(r, 50));
    MockEmailProvider.sentEmails.push(payload);
    return true;
  }

  static getSentEmails() {
    return this.sentEmails;
  }

  static clearSent() {
    this.sentEmails = [];
  }
}
