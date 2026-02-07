import { Request } from 'express';
import { OrgRole, SystemRole } from '@prisma/client';

export interface UserPayload {
  id: string;
  email: string;
  role: SystemRole;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
  orgMember?: {
    orgId: string;
    role: OrgRole;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    hasNextPage: boolean;
    endCursor: string | null;
    totalCount: number;
  };
}
