import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { shortId } from '../shared/ids';
import { metrics } from '../shared/metrics';
import { logger } from '../shared/logger';

/**
 * Assigns a request id and records basic request timing/throughput metrics. The
 * request id is echoed back in the `x-request-id` response header so it can be
 * correlated across logs.
 */
export function requestContext(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : shortId(12);
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();
  metrics.increment('http_requests_total', 1, { method: req.method });

  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.observe('http_request_duration_ms', duration, {
      method: req.method,
      status: String(res.statusCode),
    });
    if (duration > 500) {
      logger.warn(`Slow request ${req.method} ${req.originalUrl} took ${duration}ms (req ${requestId})`);
    }
  });

  next();
}
