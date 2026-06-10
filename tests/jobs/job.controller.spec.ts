import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/jobs/job.runner', () => ({
  JobRunner: {
    getJobs: vi.fn(),
    getLogs: vi.fn(),
    runJob: vi.fn(),
    runAll: vi.fn(),
  },
}));

vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));

import { jobRouter } from '../../src/jobs/job.controller';
import { JobRunner } from '../../src/jobs/job.runner';

function layerFor(method: string, path: string) {
  const layer = (jobRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`no route ${method} ${path}`);
  return layer.route.stack;
}
const handlerFor = (m: string, p: string) => layerFor(m, p)[layerFor(m, p).length - 1].handle;
// requireAdmin is the guard sitting just before the final handler.
const guardFor = (m: string, p: string) => layerFor(m, p)[layerFor(m, p).length - 2].handle;

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('job.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('requireAdmin guard', () => {
    it('rejects non system-admins with a ForbiddenError', () => {
      const next = vi.fn();
      guardFor('get', '/')({ user: { role: 'USER' } }, mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/system administrators/i) }));
    });

    it('allows system administrators through', () => {
      const next = vi.fn();
      guardFor('get', '/')({ user: { role: 'SYSTEM_ADMIN' } }, mockRes(), next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  it('GET / lists registered jobs by name', () => {
    (JobRunner.getJobs as any).mockReturnValue([{ name: 'a', handler: () => {} }, { name: 'b' }]);
    const res = mockRes();
    handlerFor('get', '/')({}, res);
    expect(res.json).toHaveBeenCalledWith({ jobs: [{ name: 'a' }, { name: 'b' }] });
  });

  it('GET /logs returns the runner logs', () => {
    (JobRunner.getLogs as any).mockReturnValue(['ran a']);
    const res = mockRes();
    handlerFor('get', '/logs')({}, res);
    expect(res.json).toHaveBeenCalledWith({ logs: ['ran a'] });
  });

  it('POST /:name/run runs a single job', async () => {
    (JobRunner.runJob as any).mockResolvedValue(undefined);
    const res = mockRes();
    await handlerFor('post', '/:name/run')({ params: { name: 'cleanup' } }, res, vi.fn());
    expect(JobRunner.runJob).toHaveBeenCalledWith('cleanup');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('POST /:name/run forwards runner errors to next()', async () => {
    const boom = new Error('no such job');
    (JobRunner.runJob as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('post', '/:name/run')({ params: { name: 'x' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('POST /run-all runs every job', async () => {
    (JobRunner.runAll as any).mockResolvedValue(undefined);
    const res = mockRes();
    await handlerFor('post', '/run-all')({}, res, vi.fn());
    expect(JobRunner.runAll).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('POST /run-all forwards errors to next()', async () => {
    const boom = new Error('boom');
    (JobRunner.runAll as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('post', '/run-all')({}, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
