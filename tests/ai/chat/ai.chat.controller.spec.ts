import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/ai/chat/ai.chat.service', () => ({
  AIChatService: { askQuestion: vi.fn() },
}));

vi.mock('../../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));

import { aiChatRouter } from '../../../src/ai/chat/ai.chat.controller';
import { AIChatService } from '../../../src/ai/chat/ai.chat.service';

function handlerFor(method: string, path: string) {
  const layer = (aiChatRouter as any).stack.find(
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

describe('ai.chat.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /:projectId forwards the question with history', async () => {
    (AIChatService.askQuestion as any).mockResolvedValue({ answer: '42' });
    const req: any = {
      params: { projectId: 'p1' },
      user: { id: 'u1' },
      body: { orgId: 'org1', question: 'why?', history: [{ role: 'user', content: 'hi' }] },
    };
    const res = mockRes();
    await handlerFor('post', '/:projectId')(req, res, vi.fn());
    expect(AIChatService.askQuestion).toHaveBeenCalledWith('u1', 'org1', 'p1', 'why?', [
      { role: 'user', content: 'hi' },
    ]);
    expect(res.json).toHaveBeenCalledWith({ answer: '42' });
  });

  it('defaults history to an empty array when omitted', async () => {
    (AIChatService.askQuestion as any).mockResolvedValue({ answer: 'ok' });
    const req: any = {
      params: { projectId: 'p1' },
      user: { id: 'u1' },
      body: { orgId: 'org1', question: 'q' },
    };
    await handlerFor('post', '/:projectId')(req, mockRes(), vi.fn());
    expect(AIChatService.askQuestion).toHaveBeenCalledWith('u1', 'org1', 'p1', 'q', []);
  });

  it('forwards errors to next()', async () => {
    const boom = new Error('ai down');
    (AIChatService.askQuestion as any).mockRejectedValue(boom);
    const next = vi.fn();
    const req: any = { params: { projectId: 'p1' }, user: { id: 'u1' }, body: {} };
    await handlerFor('post', '/:projectId')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
