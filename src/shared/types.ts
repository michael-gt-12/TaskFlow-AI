import { Request } from 'express';
import { OrgRole, ProjectRole, SystemRole } from '@prisma/client';
import { Capability } from './permissions';

export interface UserPayload {
  id: string;
  email: string;
  role: SystemRole;
}

export interface OrgMembershipContext {
  orgId: string;
  role: OrgRole;
  capabilities?: Capability[];
}

export interface ProjectMembershipContext {
  projectId: string;
  role: ProjectRole;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
  orgMember?: OrgMembershipContext;
  projectMember?: ProjectMembershipContext;
  apiKeyId?: string;
  requestId?: string;
}

export interface PaginationMeta {
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface OffsetPageMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface OffsetPaginatedResult<T> {
  data: T[];
  meta: OffsetPageMeta;
}

export type EntityType =
  | 'task'
  | 'project'
  | 'comment'
  | 'user'
  | 'organization'
  | 'milestone'
  | 'sprint';

export interface ActorContext {
  userId: string;
  orgId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * A discriminated union describing the outcome of an authorization check, used
 * by services that need to branch on the reason an action was denied rather
 * than simply throwing.
 */
export type AuthzDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export function buildOffsetMeta(
  page: number,
  pageSize: number,
  totalCount: number
): OffsetPageMeta {
  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0;
  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
