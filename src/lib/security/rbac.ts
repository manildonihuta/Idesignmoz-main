export const ROLES = [
  "super_admin",
  "admin",
  "manager",
  "sales",
  "developer",
  "designer",
  "support",
  "customer",
] as const;

export type Role = (typeof ROLES)[number];

export const LEGACY_ROLE_MAP: Record<string, Role> = {
  client: "customer",
};

export const STAFF_ROLES: Role[] = [
  "super_admin",
  "admin",
  "manager",
  "sales",
  "developer",
  "designer",
  "support",
];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  sales: "Sales",
  developer: "Developer",
  designer: "Designer",
  support: "Support",
  customer: "Customer",
};

export const PERMISSIONS = {
  "dashboard.view": ["super_admin", "admin", "manager", "sales", "developer", "designer", "support"],
  "analytics.view": ["super_admin", "admin", "manager", "sales"],
  "operations.view": ["super_admin", "admin", "manager", "sales", "support"],
  "proposals.view": ["super_admin", "admin", "manager", "sales"],
  "proposals.manage": ["super_admin", "admin", "manager", "sales"],
  "proposals.delete": ["super_admin", "admin"],
  "orders.view": ["super_admin", "admin", "manager", "sales"],
  "orders.manage": ["super_admin", "admin", "manager", "sales"],
  "messages.view": ["super_admin", "admin", "manager", "sales", "support"],
  "messages.manage": ["super_admin", "admin", "manager", "support"],
  "domains.admin": ["super_admin", "admin", "manager", "developer", "support"],
  "domains.register": ["super_admin", "admin", "manager", "sales", "developer"],
  "hosting.manage": ["super_admin", "admin", "manager", "developer"],
  "provisioning.manage": ["super_admin", "admin", "manager", "developer"],
  "billing.manage": ["super_admin", "admin", "manager"],
  "profiles.manage": ["super_admin", "admin"],
  "settings.manage": ["super_admin", "admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function normalizeRole(raw: string | null | undefined): Role {
  if (!raw) return "customer";
  const clean = raw.trim().toLowerCase();
  if ((ROLES as readonly string[]).includes(clean)) return clean as Role;
  if (LEGACY_ROLE_MAP[clean]) return LEGACY_ROLE_MAP[clean];
  return "customer";
}

export function isRoleStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isRoleIn(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsForRole(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) =>
    hasPermission(role, permission),
  );
}