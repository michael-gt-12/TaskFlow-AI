export const JWT_ACCESS_EXPIRATION = '15m';
export const JWT_REFRESH_EXPIRATION = '7d';

// Cache TTLs (seconds)
export const CACHE_TTL_DEFAULT = 300; // 5 minutes
export const CACHE_TTL_SHORT = 60; // 1 minute
export const CACHE_TTL_ANALYTICS = 1800; // 30 minutes
export const CACHE_TTL_SEARCH = 120; // 2 minutes
export const CACHE_TTL_MEMBERSHIP = 120; // 2 minutes

// Cache key namespaces — centralised so invalidation logic stays consistent.
export const CacheKeys = {
  task: (id: string) => `task:${id}`,
  taskList: (projectId: string, hash: string) => `tasks:project:${projectId}:${hash}`,
  taskListPattern: (projectId: string) => `tasks:project:${projectId}:*`,
  project: (id: string) => `project:${id}`,
  projectListPattern: (orgId: string) => `projects:org:${orgId}:*`,
  sprint: (id: string) => `sprint:${id}`,
  sprintListPattern: (projectId: string) => `sprints:project:${projectId}:*`,
  org: (id: string) => `org:${id}`,
  membership: (orgId: string, userId: string) => `member:${orgId}:${userId}`,
  membershipPattern: (orgId: string) => `member:${orgId}:*`,
  analyticsSummary: (orgId: string) => `analytics:summary:${orgId}`,
  analyticsProject: (projectId: string) => `analytics:project:${projectId}`,
  search: (orgId: string, hash: string) => `search:${orgId}:${hash}`,
  billing: (orgId: string) => `billing:${orgId}`,
  featureFlags: () => 'feature-flags:all',
} as const;

// Pagination defaults
export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 100;

// Invitation / token lifetimes
export const INVITATION_TTL_DAYS = 7;
export const PASSWORD_RESET_TTL_MINUTES = 30;
export const EMAIL_VERIFICATION_TTL_HOURS = 48;
export const SESSION_TTL_DAYS = 7;

// Billing tier limits. null means unlimited.
export interface TierLimits {
  maxMembers: number | null;
  maxProjects: number | null;
  maxTasksPerProject: number | null;
  maxWebhooks: number | null;
  maxApiKeys: number | null;
  aiRequestsPerDay: number | null;
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  FREE: {
    maxMembers: 5,
    maxProjects: 3,
    maxTasksPerProject: 200,
    maxWebhooks: 1,
    maxApiKeys: 2,
    aiRequestsPerDay: 25,
  },
  STARTER: {
    maxMembers: 15,
    maxProjects: 10,
    maxTasksPerProject: 1000,
    maxWebhooks: 5,
    maxApiKeys: 10,
    aiRequestsPerDay: 200,
  },
  PRO: {
    maxMembers: 50,
    maxProjects: 50,
    maxTasksPerProject: 5000,
    maxWebhooks: 25,
    maxApiKeys: 50,
    aiRequestsPerDay: 2000,
  },
  ENTERPRISE: {
    maxMembers: null,
    maxProjects: null,
    maxTasksPerProject: null,
    maxWebhooks: null,
    maxApiKeys: null,
    aiRequestsPerDay: null,
  },
};

// Activity / audit action identifiers
export const ActivityActions = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMPLETED: 'task.completed',
  TASK_DELETED: 'task.deleted',
  COMMENT_CREATED: 'comment.created',
  PROJECT_CREATED: 'project.created',
  PROJECT_ARCHIVED: 'project.archived',
  PROJECT_RESTORED: 'project.restored',
  SPRINT_STARTED: 'sprint.started',
  SPRINT_COMPLETED: 'sprint.completed',
  SPRINT_CANCELLED: 'sprint.cancelled',
  MEMBER_INVITED: 'member.invited',
  MEMBER_JOINED: 'member.joined',
  MEMBER_REMOVED: 'member.removed',
  OWNERSHIP_TRANSFERRED: 'ownership.transferred',
} as const;

export const DEFAULT_LABELS: Array<{ name: string; color: string }> = [
  { name: 'frontend', color: '#3b82f6' },
  { name: 'backend', color: '#10b981' },
  { name: 'bug', color: '#ef4444' },
  { name: 'enhancement', color: '#8b5cf6' },
  { name: 'urgent', color: '#f59e0b' },
  { name: 'research', color: '#06b6d4' },
];
