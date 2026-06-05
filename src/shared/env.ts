import { logger } from './logger';

/**
 * Centralised, typed access to environment configuration. The application is
 * designed to boot with sensible defaults so it can run locally without any
 * external services configured. Values are read lazily and cached.
 */

export type NodeEnv = 'development' | 'test' | 'production';

interface EnvConfig {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtAccessExpiration: string;
  jwtRefreshExpiration: string;
  bcryptRounds: number;
  appBaseUrl: string;
  emailFromAddress: string;
  enableBackgroundJobs: boolean;
  aiProvider: string;
  logLevel: string;
}

function readString(key: string, fallback: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  return value;
}

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    logger.warn(`Environment variable ${key} is not a number, using fallback ${fallback}`);
    return fallback;
  }
  return parsed;
}

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function resolveNodeEnv(): NodeEnv {
  const raw = (process.env.NODE_ENV || 'development').toLowerCase();
  if (raw === 'production' || raw === 'test') return raw;
  return 'development';
}

let cached: EnvConfig | null = null;

export function loadEnv(): EnvConfig {
  if (cached) return cached;

  cached = {
    nodeEnv: resolveNodeEnv(),
    port: readNumber('PORT', 3000),
    databaseUrl: readString(
      'DATABASE_URL',
      'postgresql://postgres:postgres@localhost:5432/taskflow?schema=public'
    ),
    redisUrl: readString('REDIS_URL', 'redis://localhost:6379'),
    jwtSecret: readString('JWT_SECRET', 'super_secret_jwt_key_2026'),
    jwtAccessExpiration: readString('JWT_ACCESS_EXPIRATION', '15m'),
    jwtRefreshExpiration: readString('JWT_REFRESH_EXPIRATION', '7d'),
    bcryptRounds: readNumber('BCRYPT_ROUNDS', 10),
    appBaseUrl: readString('APP_BASE_URL', 'http://localhost:3000'),
    emailFromAddress: readString('EMAIL_FROM', 'no-reply@taskflow.ai'),
    enableBackgroundJobs: readBoolean('ENABLE_BACKGROUND_JOBS', false),
    aiProvider: readString('AI_PROVIDER', 'mock'),
    logLevel: readString('LOG_LEVEL', 'info'),
  };

  return cached;
}

export const env = loadEnv();

export function isProduction(): boolean {
  return loadEnv().nodeEnv === 'production';
}

export function isTest(): boolean {
  return loadEnv().nodeEnv === 'test';
}

/**
 * Reset the cached configuration. Primarily useful in tests that mutate
 * process.env between cases.
 */
export function resetEnvCache(): void {
  cached = null;
}
