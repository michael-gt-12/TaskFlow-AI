import { Response } from 'express';
import { PaginatedResult } from './types';

/**
 * Consistent HTTP response envelopes. Controllers use these helpers so that all
 * endpoints return a predictable shape for clients.
 */

export interface ApiMeta {
  requestId?: string;
  [key: string]: unknown;
}

export function sendOk<T>(res: Response, data: T, meta?: ApiMeta): void {
  res.status(200).json({ data, ...(meta ? { meta } : {}) });
}

export function sendCreated<T>(res: Response, data: T, meta?: ApiMeta): void {
  res.status(201).json({ data, ...(meta ? { meta } : {}) });
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendPaginated<T>(res: Response, result: PaginatedResult<T>): void {
  res.status(200).json({ data: result.data, meta: result.meta });
}

export function sendAccepted<T>(res: Response, data: T): void {
  res.status(202).json({ data });
}

/**
 * Extract the bearer token from an Authorization header value.
 */
export function extractBearerToken(headerValue?: string): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/**
 * Parse the API key from either the `x-api-key` header or a bearer token that
 * uses the API key prefix convention.
 */
export function extractApiKey(headers: Record<string, unknown>): string | null {
  const headerKey = headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.length > 0) return headerKey;
  const auth = headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer tfa_')) {
    return auth.slice('Bearer '.length);
  }
  return null;
}
