import { OrgRole, ProjectRole } from '@prisma/client';

/**
 * Capability based permission model. Roles map to a set of capabilities and the
 * permission middleware / services check capabilities rather than hard-coding
 * role comparisons everywhere. This keeps authorization logic declarative and
 * makes it straightforward to introduce new roles in the future.
 */

export type Capability =
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  | 'org:manage_members'
  | 'org:manage_billing'
  | 'org:transfer_ownership'
  | 'org:manage_webhooks'
  | 'org:manage_api_keys'
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:archive'
  | 'project:delete'
  | 'project:manage_members'
  | 'task:create'
  | 'task:read'
  | 'task:update'
  | 'task:delete'
  | 'task:assign'
  | 'sprint:read'
  | 'sprint:manage'
  | 'milestone:read'
  | 'milestone:manage'
  | 'time:log'
  | 'time:read'
  | 'comment:create'
  | 'comment:moderate'
  | 'analytics:read'
  | 'automation:manage';

const ORG_ROLE_CAPABILITIES: Record<OrgRole, Capability[]> = {
  OWNER: [
    'org:read',
    'org:update',
    'org:delete',
    'org:manage_members',
    'org:manage_billing',
    'org:transfer_ownership',
    'org:manage_webhooks',
    'org:manage_api_keys',
    'project:create',
    'project:read',
    'project:update',
    'project:archive',
    'project:delete',
    'project:manage_members',
    'task:create',
    'task:read',
    'task:update',
    'task:delete',
    'task:assign',
    'sprint:read',
    'sprint:manage',
    'milestone:read',
    'milestone:manage',
    'time:log',
    'time:read',
    'comment:create',
    'comment:moderate',
    'analytics:read',
    'automation:manage',
  ],
  ADMIN: [
    'org:read',
    'org:update',
    'org:manage_members',
    'org:manage_webhooks',
    'org:manage_api_keys',
    'project:create',
    'project:read',
    'project:update',
    'project:archive',
    'project:manage_members',
    'task:create',
    'task:read',
    'task:update',
    'task:delete',
    'task:assign',
    'sprint:read',
    'sprint:manage',
    'milestone:read',
    'milestone:manage',
    'time:log',
    'time:read',
    'comment:create',
    'comment:moderate',
    'analytics:read',
    'automation:manage',
  ],
  MEMBER: [
    'org:read',
    'project:read',
    'project:create',
    'task:create',
    'task:read',
    'task:update',
    'task:assign',
    'sprint:read',
    'milestone:read',
    'time:log',
    'time:read',
    'comment:create',
    'analytics:read',
  ],
  GUEST: ['org:read', 'project:read', 'task:read', 'sprint:read', 'milestone:read', 'time:read', 'comment:create'],
};

const PROJECT_ROLE_CAPABILITIES: Record<ProjectRole, Capability[]> = {
  LEAD: [
    'project:read',
    'project:update',
    'project:archive',
    'project:manage_members',
    'task:create',
    'task:read',
    'task:update',
    'task:delete',
    'task:assign',
    'sprint:read',
    'sprint:manage',
    'milestone:read',
    'milestone:manage',
    'time:log',
    'time:read',
    'comment:create',
    'comment:moderate',
    'automation:manage',
  ],
  CONTRIBUTOR: [
    'project:read',
    'task:create',
    'task:read',
    'task:update',
    'task:assign',
    'sprint:read',
    'milestone:read',
    'time:log',
    'time:read',
    'comment:create',
  ],
  VIEWER: ['project:read', 'task:read', 'sprint:read', 'milestone:read', 'time:read', 'comment:create'],
};

export function orgRoleCapabilities(role: OrgRole): Set<Capability> {
  return new Set(ORG_ROLE_CAPABILITIES[role] ?? []);
}

export function projectRoleCapabilities(role: ProjectRole): Set<Capability> {
  return new Set(PROJECT_ROLE_CAPABILITIES[role] ?? []);
}

export function orgRoleHasCapability(role: OrgRole, capability: Capability): boolean {
  return orgRoleCapabilities(role).has(capability);
}

export function projectRoleHasCapability(role: ProjectRole, capability: Capability): boolean {
  return projectRoleCapabilities(role).has(capability);
}

/**
 * Numeric priority used for quick "at least this role" comparisons. Higher is
 * more privileged.
 */
export const ORG_ROLE_PRIORITY: Record<OrgRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  GUEST: 1,
};

export function orgRoleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ORG_ROLE_PRIORITY[role] >= ORG_ROLE_PRIORITY[minimum];
}

/**
 * Resolve the effective capability set for a user given both their org role and
 * (optionally) their project role. The union of both grants applies.
 */
export function effectiveCapabilities(
  orgRole: OrgRole,
  projectRole?: ProjectRole | null
): Set<Capability> {
  const caps = orgRoleCapabilities(orgRole);
  if (projectRole) {
    for (const cap of projectRoleCapabilities(projectRole)) caps.add(cap);
  }
  return caps;
}
