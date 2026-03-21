import { describe, it, expect } from 'vitest';
import { AiService } from './ai.service';

describe('AiService', () => {
  it('should generate mock task summary', async () => {
    const result = await AiService.getTaskSummary('Fix DB stale', 'Metrics is wrong');
    expect(result.summary).toBeDefined();
    expect(result.keyIssues.length).toBeGreaterThan(0);
  });
});
