import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserPayload } from '../shared/types';
import { JWT_ACCESS_EXPIRATION, JWT_REFRESH_EXPIRATION } from '../shared/constants';
import { UnauthorizedError } from '../shared/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_2026';

export class CryptoUtils {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateAccessToken(payload: UserPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRATION });
  }

  static generateRefreshToken(payload: UserPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRATION });
  }

  static verifyToken(token: string): UserPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as UserPayload;
    } catch (err) {
      throw new UnauthorizedError('Token is invalid or expired');
    }
  }
}
