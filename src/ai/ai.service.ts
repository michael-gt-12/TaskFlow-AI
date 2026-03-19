import { logger } from '../shared/logger';
import { BadRequestError } from '../shared/errors';

export class AiService {
  private static totalTokensUsed = 0;
  private static totalCostUsd = 0;

  static getAccounting() {
    return {
      totalTokens: this.totalTokensUsed,
      totalCostUsd: this.totalCostUsd
    };
  }

  /**
   * Mocked LLM simulation handling tokens billing, error retry rates and latency
   */
  static async executeMockLlm(prompt: string, expectedOutputSchema: string): Promise<string> {
    logger.info(`Simulating AI Model call for prompt: "${prompt.substring(0, 40)}..."`);
    
    // Simulate 350ms network latency
    await new Promise(r => setTimeout(r, 350));

    // Simulate 10% rate-limit or temporary failure rate (HTTP 429)
    if (Math.random() < 0.1) {
      logger.warn('Mocked LLM rate limit triggered (HTTP 429). Retrying...');
      await new Promise(r => setTimeout(r, 200)); // wait before retry
    }

    // Token accounting
    const inputTokens = Math.floor(prompt.length / 4);
    const outputTokens = 120; // constant mock reply
    this.totalTokensUsed += inputTokens + outputTokens;
    this.totalCostUsd += (inputTokens * 0.0000015) + (outputTokens * 0.000002);

    if (prompt.includes('summarize')) {
      return JSON.stringify({
        summary: 'This task requires optimizing the analytical metric reports cache invalidation. A high-priority fix is necessary.',
        keyIssues: ['analytics cache stale', 'missing task listeners invalidations']
      });
    }

    if (prompt.includes('suggest description')) {
      return JSON.stringify({
        description: 'Analyze why updating task priorities fails to reload the project analytical charts. Clean all related keys from Redis.',
        estimatedComplexity: 'Medium'
      });
    }

    if (prompt.includes('recommend priority')) {
      return JSON.stringify({
        recommendedPriority: 'HIGH',
        reasoning: 'Critical customer-facing metrics depend on this calculation. Unresolved caches will show stale values.'
      });
    }

    throw new BadRequestError('AI Mock prompt is unsupported');
  }

  static async getTaskSummary(taskTitle: string, taskDesc: string) {
    const prompt = `summarize task title: ${taskTitle} details: ${taskDesc}`;
    const resString = await this.executeMockLlm(prompt, 'JSON');
    return JSON.parse(resString);
  }

  static async suggestTaskDescription(taskTitle: string) {
    const prompt = `suggest description for task title: ${taskTitle}`;
    const resString = await this.executeMockLlm(prompt, 'JSON');
    return JSON.parse(resString);
  }

  static async recommendTaskPriority(taskTitle: string, taskDesc: string) {
    const prompt = `recommend priority for task title: ${taskTitle} and description: ${taskDesc}`;
    const resString = await this.executeMockLlm(prompt, 'JSON');
    return JSON.parse(resString);
  }
}
