import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { CryptoUtils } from '../utils/crypto';
import { UnauthorizedError } from '../shared/errors';

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = CryptoUtils.verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}
