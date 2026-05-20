export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

export interface WebhookPayload {
  url: string;
  event: string;
  payload: any;
}

export interface EmailProvider {
  sendEmail(payload: EmailPayload): Promise<boolean>;
}

export interface WebhookProvider {
  sendWebhook(payload: WebhookPayload): Promise<boolean>;
}

export interface IdentityProvider {
  linkSSOUser(userId: string, ssoId: string, providerName: string): Promise<boolean>;
}
