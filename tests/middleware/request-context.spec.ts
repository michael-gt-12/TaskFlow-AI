import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestContext } from '../../src/middleware/request-context';
import { shortId } from '../../src/shared/ids';
import { metrics } from '../../src/shared/metrics';
import { logger } from '../../src/shared/logger';

vi.mock('../../src/shared/ids', () => ({
  shortId: vi.fn(() => 'mock-short-id'),
}));

vi.mock('../../src/shared/metrics', () => ({
  metrics: {
    increment: vi.fn(),
    observe: vi.fn(),
  },
}));

vi.mock('../../src/shared/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('Request Context Middleware', () => {
  let req: any;
  let res: any;
  let next: any;
  let finishCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    finishCallback = null;
    req = {
      headers: {},
      method: 'GET',
      originalUrl: '/api/v1/test',
    };
    res = {
      setHeader: vi.fn(),
      on: vi.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      }),
      statusCode: 200,
    };
    next = vi.fn();
  });

  it('should reuse existing x-request-id if present in headers', () => {
    req.headers['x-request-id'] = 'existing-id-123';
    requestContext(req, res, next);

    expect(req.requestId).toBe('existing-id-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'existing-id-123');
    expect(shortId).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should generate a new request ID if x-request-id header is missing', () => {
    requestContext(req, res, next);

    expect(req.requestId).toBe('mock-short-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'mock-short-id');
    expect(shortId).toHaveBeenCalledWith(12);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should increment http_requests_total metric', () => {
    requestContext(req, res, next);

    expect(metrics.increment).toHaveBeenCalledWith('http_requests_total', 1, { method: 'GET' });
  });

  it('should record request duration on finish event', () => {
    vi.useFakeTimers();
    requestContext(req, res, next);

    expect(finishCallback).toBeTypeOf('function');
    
    // Advance timer by 200ms
    vi.advanceTimersByTime(200);
    finishCallback!();

    expect(metrics.observe).toHaveBeenCalledWith('http_request_duration_ms', 200, {
      method: 'GET',
      status: '200',
    });
    expect(logger.warn).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should log warning if request duration exceeds 500ms', () => {
    vi.useFakeTimers();
    requestContext(req, res, next);

    expect(finishCallback).toBeTypeOf('function');
    
    // Advance timer by 600ms (slow request)
    vi.advanceTimersByTime(600);
    finishCallback!();

    expect(metrics.observe).toHaveBeenCalledWith('http_request_duration_ms', 600, {
      method: 'GET',
      status: '200',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Slow request GET /api/v1/test took 600ms (req mock-short-id)')
    );

    vi.useRealTimers();
  });
});
