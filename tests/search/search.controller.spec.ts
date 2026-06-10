import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/search/search.service', () => ({
  SearchService: { search: vi.fn() },
}));

vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));

import { searchRouter } from '../../src/search/search.controller';
import { SearchService } from '../../src/search/search.service';

function handlerFor(method: string, path: string) {
  const layer = (searchRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`no route ${method} ${path}`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('search.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET / runs a typed search', async () => {
    (SearchService.search as any).mockResolvedValue([{ id: 't1' }]);
    const req: any = { query: { q: 'bug', type: 'TASK' } };
    const res = mockRes();
    await handlerFor('get', '/')(req, res, vi.fn());
    expect(SearchService.search).toHaveBeenCalledWith('bug', 'TASK');
    expect(res.json).toHaveBeenCalledWith([{ id: 't1' }]);
  });

  it('GET / short-circuits to an empty array when the query is missing', async () => {
    const req: any = { query: {} };
    const res = mockRes();
    await handlerFor('get', '/')(req, res, vi.fn());
    expect(SearchService.search).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('forwards search errors to next()', async () => {
    const boom = new Error('index down');
    (SearchService.search as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('get', '/')({ query: { q: 'x' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
