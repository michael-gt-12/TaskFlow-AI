import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { prisma } from '../database/client';
import { UnauthorizedError, ForbiddenError } from '../shared/errors';
import { extractApiKey } from '../shared/http';
import { hashToken, constantTimeEquals } from '../shared/ids';
import { SystemRole } from '@prisma/client';

/**
 * Authenticate a request using an API key supplied via the `x-api-key` header
 * or a bearer token with the `tfa_` prefix. On success the request is populated
 * with a synthetic user payload representing the key owner plus the resolved
 * organization context.
 *
 * Keys are stored as `prefix.secret`; only the hash of the secret is persisted.
 */
export function apiKeyAuth(requiredScope?: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const raw = extractApiKey(req.headers as Record<string, unknown>);
      if (!raw) return next(new UnauthorizedError('API key required'));

      const [prefix, secret] = raw.split('.');
      if (!prefix || !secret) return next(new UnauthorizedError('Malformed API key'));

      const apiKey = await prisma.apiKey.findUnique({
        where: { prefix },
        include: { user: true },
      });

      if (!apiKey || apiKey.status !== 'ACTIVE') {
        return next(new UnauthorizedError('Invalid API key'));
      }
      if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
        return next(new UnauthorizedError('API key has expired'));
      }
      if (!constantTimeEquals(apiKey.hashedKey, hashToken(secret))) {
        return next(new UnauthorizedError('Invalid API key'));
      }
      if (requiredScope && !apiKey.scopes.includes(requiredScope) && !apiKey.scopes.includes('*')) {
        return next(new ForbiddenError(`API key is missing required scope: ${requiredScope}`));
      }

      // Best-effort last-used tracking; never blocks the request.
      prisma.apiKey
        .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);

      req.user = {
        id: apiKey.userId,
        email: apiKey.user.email,
        role: apiKey.user.role as SystemRole,
      };
      req.apiKeyId = apiKey.id;
      req.orgMember = { orgId: apiKey.organizationId, role: 'ADMIN' as any };
      next();
    } catch (err) {
      next(err);
    }
  };
}
