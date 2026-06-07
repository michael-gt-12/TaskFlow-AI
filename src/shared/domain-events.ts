/**
 * Canonical catalogue of domain event names and their payload shapes. The
 * runtime publisher (see events.ts) is intentionally loosely typed so that any
 * subsystem can subscribe, but call sites should prefer these constants and
 * interfaces to keep payloads consistent across publishers and listeners.
 */

export const DomainEvents = {
  // Auth & users
  UserRegistered: 'user.registered',
  UserLoggedIn: 'user.logged_in',
  PasswordReset: 'user.password_reset',

  // Organizations
  OrgCreated: 'org.created',
  OrgUpdated: 'org.updated',
  OrgOwnershipTransferred: 'org.ownership_transferred',
  MemberInvited: 'org.member_invited',
  MemberJoined: 'org.member_joined',
  MemberRemoved: 'org.member_removed',
  MemberRoleChanged: 'org.member_role_changed',

  // Projects
  ProjectCreated: 'project.created',
  ProjectUpdated: 'project.updated',
  ProjectArchived: 'project.archived',
  ProjectRestored: 'project.restored',
  ProjectDeleted: 'project.deleted',

  // Tasks
  TaskCreated: 'task.created',
  TaskUpdated: 'task.updated',
  TaskStatusChanged: 'task.status_changed',
  TaskAssigned: 'task.assigned',
  TaskUnassigned: 'task.unassigned',
  TaskCompleted: 'task.completed',
  TaskDeleted: 'task.deleted',
  TaskDueSoon: 'task.due_soon',
  TaskDependencyAdded: 'task.dependency_added',
  TaskDependencyRemoved: 'task.dependency_removed',

  // Comments
  CommentCreated: 'comment.created',
  CommentUpdated: 'comment.updated',
  CommentDeleted: 'comment.deleted',
  MentionCreated: 'comment.mention',

  // Sprints & milestones
  SprintStarted: 'sprint.started',
  SprintCompleted: 'sprint.completed',
  SprintCancelled: 'sprint.cancelled',
  MilestoneReached: 'milestone.reached',
  MilestoneMissed: 'milestone.missed',

  // Billing
  SubscriptionChanged: 'billing.subscription_changed',
  InvoiceIssued: 'billing.invoice_issued',
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];

export interface BaseEventPayload {
  orgId: string;
  userId: string;
}

export interface TaskEventPayload extends BaseEventPayload {
  taskId: string;
  projectId: string;
  taskTitle: string;
}

export interface TaskStatusChangedPayload extends TaskEventPayload {
  oldStatus: string;
  newStatus: string;
}

export interface TaskAssignedPayload extends TaskEventPayload {
  assigneeId: string;
  previousAssigneeId?: string | null;
}

export interface ProjectEventPayload extends BaseEventPayload {
  projectId: string;
  projectName: string;
}

export interface CommentEventPayload extends BaseEventPayload {
  commentId: string;
  taskId: string;
  projectId: string;
  mentionedUserIds: string[];
}

export interface MemberEventPayload extends BaseEventPayload {
  targetUserId: string;
  role?: string;
}

export interface InvitationEventPayload extends BaseEventPayload {
  invitationId: string;
  email: string;
  role: string;
}

export interface SprintEventPayload extends BaseEventPayload {
  sprintId: string;
  projectId: string;
  sprintName: string;
}

export interface SprintCompletedPayload extends SprintEventPayload {
  completedTasks: number;
  carriedOverTasks: number;
}

export interface MilestoneEventPayload extends BaseEventPayload {
  milestoneId: string;
  projectId: string;
  milestoneName: string;
}

export interface TaskDependencyEventPayload extends BaseEventPayload {
  projectId: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: string;
}

/**
 * The full set of webhook-eligible events. Only a subset of domain events are
 * exposed to external webhook consumers.
 */
export const WEBHOOK_EVENTS: DomainEventName[] = [
  DomainEvents.TaskCreated,
  DomainEvents.TaskUpdated,
  DomainEvents.TaskStatusChanged,
  DomainEvents.TaskAssigned,
  DomainEvents.TaskCompleted,
  DomainEvents.ProjectCreated,
  DomainEvents.ProjectArchived,
  DomainEvents.CommentCreated,
  DomainEvents.MemberJoined,
];

export function isWebhookEvent(name: string): boolean {
  return WEBHOOK_EVENTS.includes(name as DomainEventName);
}
