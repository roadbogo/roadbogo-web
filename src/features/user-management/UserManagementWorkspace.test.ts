import { describe, expect, it } from "vitest";
import { buildUserUpdatePatch } from "./UserManagementWorkspace";
import type { ManagedUser } from "./userManagementTypes";
import {normalizeUserDirectoryPageSize,USER_DIRECTORY_DEFAULT_PAGE_SIZE} from "./userManagementTypes";

const user: ManagedUser = {
  publicId: "user-public-id",
  email: "controller@roadbogo.kr",
  userName: "김관제",
  phone: "01012345678",
  accountStatus: "ACTIVE",
  organization: { publicId: "organization-a", name: "중부 관제센터" },
  roles: ["CONTROLLER"],
  lastLoginAt: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  changes: [],
};

describe("buildUserUpdatePatch", () => {
  it("정규화한 값이 같으면 빈 PATCH를 만든다", () => {
    expect(buildUserUpdatePatch(user, {
      userName: " 김관제 ",
      phone: "010-1234-5678",
      organizationPublicId: "organization-a",
    })).toEqual({});
  });

  it("실제로 변경된 수정 가능 필드만 만든다", () => {
    expect(buildUserUpdatePatch(user, {
      userName: " 김도로 ",
      phone: "010-8765-4321",
      organizationPublicId: "organization-b",
    })).toEqual({
      userName: "김도로",
      phone: "01087654321",
      organizationPublicId: "organization-b",
    });
  });

  it("전화번호를 비운 경우에만 null을 포함한다", () => {
    expect(buildUserUpdatePatch(user, {
      userName: user.userName,
      phone: "",
      organizationPublicId: "organization-a",
    })).toEqual({ phone: null });
  });
});

describe("user directory page size",()=>{
  it("uses 10 when size is absent or invalid",()=>{
    expect(USER_DIRECTORY_DEFAULT_PAGE_SIZE).toBe(10);
    expect(normalizeUserDirectoryPageSize(null)).toBe(10);
    expect(normalizeUserDirectoryPageSize("15")).toBe(10);
    expect(normalizeUserDirectoryPageSize("invalid")).toBe(10);
  });
  it.each([10,20,50])("preserves supported size %s",(size)=>{
    expect(normalizeUserDirectoryPageSize(String(size))).toBe(size);
  });
});
