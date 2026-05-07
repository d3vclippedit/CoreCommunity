import type { CommunityRole } from "../../db/schema";

const ROLE_RANK: Record<CommunityRole, number> = {
  member: 0,
  mod: 1,
  senior_mod: 2,
  admin: 3,
  streamer: 4,
};

export function roleAtLeast(role: CommunityRole | null | undefined, min: CommunityRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function isStaff(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "mod");
}

export function canRemovePost(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "mod");
}

export function canRemoveComment(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "mod");
}

export function canPinPost(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "mod");
}

export function canFeaturePost(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "senior_mod");
}

export function canTimeoutUser(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "mod");
}

export function canBanUser(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "senior_mod");
}

export function canManageRules(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "senior_mod");
}

export function canManageStaff(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "senior_mod");
}

export function canCustomizeTheme(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "admin");
}

export function canManageMods(
  actorRole: CommunityRole | null | undefined,
  targetRole: CommunityRole,
): boolean {
  if (!actorRole) return false;
  // Streamer/Admin can manage anyone below them
  if (roleAtLeast(actorRole, "admin")) return ROLE_RANK[targetRole] < ROLE_RANK[actorRole];
  // Senior Mod can only manage Mods
  if (actorRole === "senior_mod") return targetRole === "mod";
  return false;
}

export function canManageAdmins(role: CommunityRole | null | undefined): boolean {
  return role === "streamer";
}

export function canDeleteCommunity(role: CommunityRole | null | undefined): boolean {
  return role === "streamer";
}

export function canPostInAnnouncements(role: CommunityRole | null | undefined): boolean {
  return roleAtLeast(role, "senior_mod");
}
