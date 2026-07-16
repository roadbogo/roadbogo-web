import type { UserRole } from "@/types/auth";

export type SidebarIconName = "home" | "flow" | "login" | "profile";

export type SidebarMenuItem = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  icon: SidebarIconName;
  roles: UserRole[];
  section?: string;
  children?: SidebarMenuItem[];
  isExternal?: boolean;
  badge?: string | number;
  targetSection?: "home" | "platform-operations";
};

export const allSidebarRoles: UserRole[] = [
  "SYSTEM_ADMIN",
  "CONTROL_MANAGER",
  "CONTROLLER",
  "RESPONDER",
  "GENERAL_USER",
];

const publicMenus: SidebarMenuItem[] = [
  {
    id: "home",
    label: "서비스 소개",
    description: "도로보GO 주요 기능 안내",
    href: "/#home",
    targetSection: "home",
    icon: "home",
    roles: allSidebarRoles,
    section: "서비스",
  },
  {
    id: "platform",
    label: "통합 사건 운영 체계",
    description: "탐지부터 현장 조치까지",
    href: "/#platform-operations",
    targetSection: "platform-operations",
    icon: "flow",
    roles: allSidebarRoles,
    section: "서비스",
  },
];

export function getLandingSidebarMenus(role: UserRole, authenticated: boolean): SidebarMenuItem[] {
  const accountMenu: SidebarMenuItem = authenticated
    ? { id: "mypage", label: "마이페이지", description: "계정 및 권한 정보", href: "/mypage", icon: "profile", roles: allSidebarRoles, section: "계정" }
    : { id: "login", label: "로그인", description: "서비스 계정 접속", href: "/login?intent=general", icon: "login", roles: ["GENERAL_USER"], section: "계정" };

  const filterByRole = (items: SidebarMenuItem[]): SidebarMenuItem[] => items
    .filter((item) => item.roles.includes(role))
    .map((item) => ({ ...item, children: item.children ? filterByRole(item.children) : undefined }));

  return filterByRole([...publicMenus, accountMenu]);
}
