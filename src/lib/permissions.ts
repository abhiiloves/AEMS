// Server-side permission helpers.
//
// These intentionally mirror the SQL in 006_rls_policies.sql. The old
// system's permission matrix (userPermissions.ts) lived ONLY in the
// frontend, which is how the write endpoints ended up unprotected.
// Here the same checks exist twice on purpose: once as RLS (the real
// guarantee, enforced even if application code has a bug), and once
// here (so the API layer can return a clean 403 instead of a raw
// Postgres RLS error, and so UI-gating logic has one source of truth
// to import instead of re-deriving the rules).

export type Role = "it_admin" | "admin" | "hr" | "user";

export interface AppUser {
  id: string;
  role: Role;
  scope: Array<{
    categoryId: string | null;
    locationId: string | null;
    plantId: string | null;
    canEdit: boolean;
  }>;
}

export function hasScope(
  user: AppUser,
  target: { categoryId?: string | null; locationId?: string | null; plantId?: string | null },
  requireEdit = false
): boolean {
  if (user.role === "it_admin") return true;
  return user.scope.some((s) => {
    if (requireEdit && !s.canEdit) return false;
    const categoryOk = s.categoryId === null || s.categoryId === target.categoryId;
    const locationOk = s.locationId === null || s.locationId === target.locationId;
    const plantOk = s.plantId === null || s.plantId === target.plantId;
    return categoryOk && locationOk && plantOk;
  });
}

export function canDeleteAsset(user: AppUser): boolean {
  // Per project decision: delete + bulk import are Admin/IT Admin only,
  // never User/HR, regardless of category/location/plant scope.
  return user.role === "admin" || user.role === "it_admin";
}

export function canBulkImport(user: AppUser, flags: { canBulkImport: boolean }): boolean {
  return (user.role === "admin" || user.role === "it_admin") && flags.canBulkImport;
}

export function canExport(user: AppUser, flags: { canExport: boolean }): boolean {
  return (user.role === "admin" || user.role === "it_admin") && flags.canExport;
}

export function canApproveScrap(user: AppUser): boolean {
  // User can only report; Admin/IT Admin can approve/reject/resolve.
  return user.role === "admin" || user.role === "it_admin";
}

export function canAssignRole(assignerRole: Role, targetRole: Role, assignerHasHrScope: boolean): boolean {
  if (assignerRole === "it_admin") return true;
  if (assignerRole !== "admin") return false;
  if (targetRole === "user") return true;
  if (targetRole === "hr") return assignerHasHrScope;
  return false; // admin cannot create admin or it_admin
}

export function auditVisibilityFilter(user: AppUser): { itAdminSeesAll: boolean } {
  return { itAdminSeesAll: user.role === "it_admin" };
}

export function sessionIdleTimeoutMinutes(role: Role): number {
  return role === "admin" || role === "it_admin" ? 5 : 240; // 5 min vs 3-4 hr
}
