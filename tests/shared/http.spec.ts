import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import {
  sendOk,
  sendCreated,
  sendNoContent,
  sendPaginated,
  sendAccepted,
  extractBearerToken,
  extractApiKey,
} from '../../src/shared/http';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response & { status: any; json: any; send: any };
}

describe('http', () => {
  describe('response envelopes', () => {
    it('sendOk wraps data with status 200', () => {
      const res = mockRes();
      sendOk(res, { id: 1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: { id: 1 } });
    });

    it('sendOk includes meta when provided', () => {
      const res = mockRes();
      sendOk(res, [1, 2], { requestId: 'abc' });
      expect(res.json).toHaveBeenCalledWith({ data: [1, 2], meta: { requestId: 'abc' } });
    });

    it('sendCreated uses status 201', () => {
      const res = mockRes();
      sendCreated(res, { id: 2 });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { id: 2 } });
    });

    it('sendNoContent uses status 204 and an empty send', () => {
      const res = mockRes();
      sendNoContent(res);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledWith();
    });

    it('sendPaginated forwards data and meta', () => {
      const res = mockRes();
      const result = {
        data: [{ id: 1 }],
        meta: { hasNextPage: false, endCursor: null, totalCount: 1 },
      };
      sendPaginated(res, result);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: result.data, meta: result.meta });
    });

    it('sendAccepted uses status 202', () => {
      const res = mockRes();
      sendAccepted(res, { jobId: 'j1' });
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ data: { jobId: 'j1' } });
    });
  });

  describe('extractBearerToken', () => {
    it('extracts the token from a Bearer header', () => {
      expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
    });

    it('is case-insensitive on the scheme', () => {
      expect(extractBearerToken('bearer token123')).toBe('token123');
    });

    it('returns null for missing or non-bearer headers', () => {
      expect(extractBearerToken(undefined)).toBeNull();
      expect(extractBearerToken('Basic xyz')).toBeNull();
      expect(extractBearerToken('Bearer')).toBeNull();
    });
  });

  describe('extractApiKey', () => {
    it('prefers the x-api-key header', () => {
      expect(extractApiKey({ 'x-api-key': 'tfa_key', authorization: 'Bearer tfa_other' })).toBe(
        'tfa_key'
      );
    });

    it('falls back to a Bearer token using the api key prefix', () => {
      expect(extractApiKey({ authorization: 'Bearer tfa_abc.secret' })).toBe('tfa_abc.secret');
    });

    it('returns null when no api key is present', () => {
      expect(extractApiKey({})).toBeNull();
      expect(extractApiKey({ authorization: 'Bearer jwt-token' })).toBeNull();
      expect(extractApiKey({ 'x-api-key': '' })).toBeNull();
    });
  });
});
