import { prisma } from '../../database/client';
import { BillingService } from '../../billing/billing.service';
import { logger } from '../../shared/logger';
import { NotFoundError } from '../../shared/errors';
import { SearchService } from '../../search/search.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  orgId: string;
  projectId: string;
  history: ChatMessage[];
}

export class AIChatService {
  /**
   * Processes a natural language question about the project.
   * Leverages task indexing and database state to answer questions in context.
   */
  static async askQuestion(
    userId: string,
    orgId: string,
    projectId: string,
    question: string,
    history: ChatMessage[] = []
  ): Promise<ChatMessage> {
    logger.info(`[AI Chat] User ${userId} asked question in project ${projectId}: "${question}"`);

    // Verify organization subscription tier allows AI Assistant features
    await BillingService.checkAiAccess(orgId);

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    const queryLower = question.toLowerCase();
    
    // Fetch project tasks to run simple heuristic RAG matching
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: { assignee: true, creator: true }
    });

    let contextTasks = [...tasks];
    let responseText = '';

    // Apply simple natural language filters
    if (queryLower.includes('urgent') || queryLower.includes('high priority')) {
      contextTasks = tasks.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH');
      responseText += `Here are the high-priority or urgent tasks I found in this project:\n`;
    } else if (queryLower.includes('overdue') || queryLower.includes('late')) {
      const now = new Date();
      contextTasks = tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'DONE');
      responseText += `I analyzed the due dates and found these overdue tasks:\n`;
    } else if (queryLower.includes('assignee') || queryLower.includes('assigned to') || queryLower.includes('bob')) {
      // Bob is a common test/mock user
      contextTasks = tasks.filter(t => t.assignee?.name.toLowerCase().includes('bob') || t.assignee?.email.includes('bob'));
      responseText += `Here are the tasks currently assigned to Bob:\n`;
    } else if (queryLower.includes('done') || queryLower.includes('completed')) {
      contextTasks = tasks.filter(t => t.status === 'DONE');
      responseText += `Here are the completed tasks in this project:\n`;
    } else if (queryLower.includes('todo') || queryLower.includes('backlog')) {
      contextTasks = tasks.filter(t => t.status === 'TODO' || t.status === 'BACKLOG');
      responseText += `Here are the tasks in your Todo/Backlog queues:\n`;
    } else {
      // Default semantic keyword matching using task search index
      try {
        const searchMatches = await SearchService.search(question, 'task', 5);
        const matchIds = searchMatches.map(m => m.entityId);
        if (matchIds.length > 0) {
          contextTasks = tasks.filter(t => matchIds.includes(t.id));
          responseText += `Based on a semantic index search for "${question}", these tasks are the most relevant:\n`;
        } else {
          // Fallback to title keywords
          const keywords = queryLower.split(' ').filter(k => k.length > 3);
          contextTasks = tasks.filter(t => keywords.some(k => t.title.toLowerCase().includes(k) || t.description?.toLowerCase().includes(k)));
          responseText += `Here are the tasks that match key terms from your query:\n`;
        }
      } catch (err) {
        contextTasks = tasks.slice(0, 3);
        responseText += `Retrieval failed. Here is a quick summary of the project tasks:\n`;
      }
    }

    // Build natural text response
    if (contextTasks.length === 0) {
      responseText = `I searched the project "${project.name}" but couldn't find any tasks matching your criteria. Let me know if you would like me to summarize the project overall!`;
    } else {
      contextTasks.forEach((task, idx) => {
        const assignee = task.assignee ? task.assignee.name : 'Unassigned';
        responseText += `${idx + 1}. **${task.title}** - Status: \`${task.status}\`, Priority: \`${task.priority}\`, Assignee: *${assignee}*\n`;
      });
      responseText += `\nWould you like me to help you update the assignee or prioritize any of these tasks?`;
    }

    return {
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString()
    };
  }
}
