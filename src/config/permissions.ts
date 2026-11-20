/**
 * Role → permissions map.
 * Adding a role = add it to ROLES and give it a permission list here. Routes don't change.
 */
export const ROLES = ['admin', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  admin: ['dashboard:read', 'doctor:read', 'doctor:write', 'patient:read', 'patient:write'],
  viewer: ['dashboard:read', 'doctor:read', 'patient:read'],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof PERMISSIONS)['admin'][number];

export function permissionsFor(role: Role): readonly Permission[] {
  return PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission) {
  return permissionsFor(role).includes(permission);
}
