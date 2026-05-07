import type { CommunityRole, communities, communityCustomRoles } from "../../db/schema";

const SYSTEM_DEFAULT_POSTS_PER_HOUR = 10;

type Community = Pick<
  typeof communities.$inferSelect,
  "memberCanPostLinks" | "memberCanPostImages" | "memberCanPostVideos" | "memberPostsPerHour"
>;
type CustomRole = Pick<
  typeof communityCustomRoles.$inferSelect,
  "canPostLinks" | "canPostImages" | "canPostVideos" | "postsPerHour"
> | null;

export type PostPerms = {
  canPostLinks: boolean;
  canPostImages: boolean;
  canPostVideos: boolean;
  postsPerHour: number; // 0 = unlimited
};

export function resolvePostPerms(
  staffRole: CommunityRole | null | undefined,
  community: Community,
  customRole: CustomRole,
): PostPerms {
  // Staff always get full access with no rate limit
  if (staffRole && staffRole !== "member") {
    return { canPostLinks: true, canPostImages: true, canPostVideos: true, postsPerHour: 0 };
  }
  if (customRole) {
    return {
      canPostLinks: customRole.canPostLinks,
      canPostImages: customRole.canPostImages,
      canPostVideos: customRole.canPostVideos,
      postsPerHour:
        customRole.postsPerHour ?? community.memberPostsPerHour ?? SYSTEM_DEFAULT_POSTS_PER_HOUR,
    };
  }
  return {
    canPostLinks: community.memberCanPostLinks,
    canPostImages: community.memberCanPostImages,
    canPostVideos: community.memberCanPostVideos,
    postsPerHour: community.memberPostsPerHour ?? SYSTEM_DEFAULT_POSTS_PER_HOUR,
  };
}

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
