import { prisma } from '../database/client';
import { CryptoUtils } from '../utils/crypto';
import { RegisterSchema, LoginSchema } from './auth.schema';
import { ConflictError, UnauthorizedError, NotFoundError } from '../shared/errors';
import { UserPayload } from '../shared/types';
import { SystemRole } from '@prisma/client';

export class AuthService {
  static async register(data: any) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existing) {
      throw new ConflictError('Email address is already in use');
    }

    const passwordHash = await CryptoUtils.hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: SystemRole.USER
      }
    });

    const payload: UserPayload = { id: user.id, email: user.email, role: user.role };
    return {
      user: { id: user.id, name: user.name, email: user.email },
      accessToken: CryptoUtils.generateAccessToken(payload),
      refreshToken: CryptoUtils.generateRefreshToken(payload)
    };
  }

  static async login(data: any) {
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await CryptoUtils.comparePassword(data.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const payload: UserPayload = { id: user.id, email: user.email, role: user.role };
    return {
      user: { id: user.id, name: user.name, email: user.email },
      accessToken: CryptoUtils.generateAccessToken(payload),
      refreshToken: CryptoUtils.generateRefreshToken(payload)
    };
  }

  static async refreshToken(token: string) {
    const payload = CryptoUtils.verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.id }
    });

    if (!user) {
      throw new UnauthorizedError('User not found or deleted');
    }

    const userPayload: UserPayload = { id: user.id, email: user.email, role: user.role };
    return {
      accessToken: CryptoUtils.generateAccessToken(userPayload),
      refreshToken: CryptoUtils.generateRefreshToken(userPayload)
    };
  }
}
