import { describe, expect, it } from "vitest";
import {
  buildProfileUpdate,
  canWithdrawAccount,
  formatPhoneForDisplay,
  getAccountShortcuts,
  getNextAccountTab,
  getPermissionGroups,
  getRoleDisplay,
  isOperationalAccount,
  normalizePhoneForComparison,
  phoneCursorPosition,
  validatePhone,
  validateProfile,
} from "./mypageUtils";

describe("account withdrawal eligibility", () => {
  it("allows only a single GENERAL_USER role", () => {
    expect(canWithdrawAccount(["GENERAL_USER"])).toBe(true);
    expect(canWithdrawAccount(["SYSTEM_ADMIN"])).toBe(false);
    expect(canWithdrawAccount(["CONTROL_MANAGER"])).toBe(false);
    expect(canWithdrawAccount(["CONTROLLER"])).toBe(false);
    expect(canWithdrawAccount(["RESPONDER"])).toBe(false);
    expect(canWithdrawAccount(["GENERAL_USER", "CONTROLLER"])).toBe(false);
    expect(canWithdrawAccount([])).toBe(false);
    expect(canWithdrawAccount(undefined)).toBe(false);
  });
});

function incidentProcessing(permissions: string[], generalUser = false) {
  return getPermissionGroups(permissions, generalUser).find(group => group.label === "사건 처리");
}

describe("getPermissionGroups incident processing", () => {
  it("shows claim-only access without implying decision access", () => {
    expect(incidentProcessing(["INCIDENT.CLAIM"])).toEqual({
      label: "사건 처리",
      state: "담당 범위만 가능",
      description: "사건 확인 및 선점 가능",
    });
  });

  it("shows decide-only access without implying claim access", () => {
    expect(incidentProcessing(["INCIDENT.DECIDE"])).toEqual({
      label: "사건 처리",
      state: "담당 범위만 가능",
      description: "허용된 사건의 판단 업무 가능",
    });
  });

  it("shows full processing access only when both permissions exist", () => {
    expect(incidentProcessing(["INCIDENT.CLAIM", "INCIDENT.DECIDE"])).toEqual({
      label: "사건 처리",
      state: "사용 가능",
      description: "사건 담당 및 판단 업무",
    });
  });

  it.each([
    [[], false],
    [[], true],
  ])("restricts incident processing with empty permissions (generalUser=%s)", (permissions, generalUser) => {
    expect(incidentProcessing(permissions, generalUser)).toEqual({
      label: "사건 처리",
      state: "접근 제한",
      description: "현재 부여된 권한 없음",
    });
  });
});

describe("getRoleDisplay", () => {
  it("uses the authenticated primary role for a general user", () => {
    expect(getRoleDisplay("GENERAL_USER", ["GENERAL_USER"])).toEqual({
      primary: "일반 사용자",
      all: ["일반 사용자"],
    });
  });

  it("uses the authenticated primary role for a single operations role", () => {
    expect(getRoleDisplay("CONTROLLER", ["CONTROLLER"])).toEqual({
      primary: "관제 담당자",
      all: ["관제 담당자"],
    });
  });

  it.each([
    [["CONTROLLER", "CONTROL_MANAGER"]],
    [["CONTROL_MANAGER", "CONTROLLER"]],
  ] as const)("keeps the primary role independent from the roles array order: %o", roles => {
    const display = getRoleDisplay("CONTROL_MANAGER", [...roles]);

    expect(display.primary).toBe("관제센터 책임자");
    expect(display.all).toEqual(roles.map(role => role === "CONTROL_MANAGER" ? "관제센터 책임자" : "관제 담당자"));
  });
});

describe("isOperationalAccount", () => {
  it("keeps a general account out of operations content", () => {
    expect(isOperationalAccount(["GENERAL_USER"])).toBe(false);
  });

  it.each(["SYSTEM_ADMIN","CONTROL_MANAGER","CONTROLLER","RESPONDER"] as const)("recognizes %s as an operations role", role => {
    expect(isOperationalAccount(["GENERAL_USER", role])).toBe(true);
  });
});

describe("getNextAccountTab", () => {
  it.each([
    ["overview", "ArrowRight", "profile"],
    ["profile", "ArrowRight", "security"],
    ["security", "ArrowRight", "overview"],
    ["security", "ArrowLeft", "profile"],
    ["profile", "ArrowLeft", "overview"],
    ["overview", "ArrowLeft", "security"],
    ["security", "Home", "overview"],
    ["profile", "End", "security"],
    ["profile", "Enter", null],
  ] as const)("moves from %s with %s to %s", (activeTab, key, expected) => {
    expect(getNextAccountTab(activeTab, key)).toBe(expected);
  });
});

function managementGroups(permissions: string[]) {
  const groups = getPermissionGroups(permissions, false);
  return {
    user: groups.find(group => group.label === "사용자 관리"),
    role: groups.find(group => group.label === "역할 관리"),
    shortcut: getAccountShortcuts(permissions).find(shortcut => shortcut.href === "/admin"),
  };
}

describe("user and role management permissions", () => {
  it.each([
    [["USER.READ_ALL"], "담당 범위만 가능", "사용자 목록 조회 가능", "접근 제한", "사용자 관리", "사용자 목록 조회"],
    [["USER.WRITE"], "담당 범위만 가능", "사용자 등록·수정 가능", "접근 제한", "사용자 관리", "사용자 등록·수정"],
    [["ROLE.MANAGE"], "접근 제한", "현재 부여된 권한 없음", "사용 가능", "역할 관리", "사용자 역할 관리"],
    [["USER.READ_ALL", "USER.WRITE"], "사용 가능", "사용자 조회·등록·수정 가능", "접근 제한", "사용자 관리", "사용자 조회·등록·수정"],
    [["USER.WRITE", "ROLE.MANAGE"], "담당 범위만 가능", "사용자 등록·수정 가능", "사용 가능", "사용자·역할 관리", "사용자 등록·수정 및 역할 관리"],
  ] as const)("keeps permission guidance and shortcut aligned for %o", (permissions, userState, userDescription, roleState, shortcutLabel, shortcutDescription) => {
    const result = managementGroups([...permissions]);

    expect(result.user).toMatchObject({ state: userState, description: userDescription });
    expect(result.role).toMatchObject({ state: roleState });
    expect(result.shortcut).toMatchObject({ label: shortcutLabel, description: shortcutDescription });
  });

  it.each([
    [[], false],
    [[], true],
  ])("does not expose management access with empty permissions (generalUser=%s)", (permissions, generalUser) => {
    const groups = getPermissionGroups(permissions, generalUser);

    expect(groups.find(group => group.label === "사용자 관리")?.state).toBe("접근 제한");
    expect(groups.find(group => group.label === "역할 관리")?.state).toBe("접근 제한");
    expect(getAccountShortcuts(permissions)).not.toContainEqual(expect.objectContaining({ href: "/admin" }));
  });

  it("shows the admin shortcut for SYSTEM_ADMIN role-derived UI permissions", () => {
    expect(getAccountShortcuts([], ["users:manage", "roles:manage"])).toContainEqual({
      href: "/admin",
      label: "사용자·역할 관리",
      description: "사용자 및 역할 관리",
    });
  });
});

describe("profile validation", () => {
  it("returns only a name error for a one-character name", () => {
    expect(validateProfile("A", "010-1234-5678")).toEqual({
      name: "사용자명은 2자 이상 100자 이하로 입력해 주세요.",
    });
  });

  it("returns only a name error for a 101-character name", () => {
    expect(validateProfile("가".repeat(101), "010-1234-5678")).toEqual({
      name: "사용자명은 2자 이상 100자 이하로 입력해 주세요.",
    });
  });

  it("returns only a phone error for an invalid phone", () => {
    expect(validateProfile("정상 이름", "010.ABCD")).toEqual({
      phone: "전화번호 형식을 확인해 주세요",
    });
  });

  it("allows an empty phone and valid profile values", () => {
    expect(validateProfile("정상 이름", "")).toEqual({});
    expect(validateProfile("정상 이름", "+82 (10) 1234-5678")).toEqual({});
  });

  it("returns errors for both invalid fields", () => {
    expect(validateProfile(" A ", "invalid")).toEqual({
      name: "사용자명은 2자 이상 100자 이하로 입력해 주세요.",
      phone: "전화번호 형식을 확인해 주세요",
    });
  });
});

describe("buildProfileUpdate", () => {
  it("includes only changed fields and leaves deletion to the explicit action", () => {
    expect(buildProfileUpdate({ name: "기존 이름", phone: "010-1234-5678" }, "새 이름", "010-1234-5678")).toEqual({
      user_name: "새 이름",
    });
    expect(buildProfileUpdate({ name: "기존 이름", phone: "010-1234-5678" }, "기존 이름", " ")).toEqual({});
  });

  it("rejects clearing a registered phone through ordinary editing", () => {
    expect(validateProfile("기존 이름", " ", "010-1234-5678")).toEqual({
      phone: "전화번호 삭제는 ‘등록된 전화번호 삭제’를 이용해 주세요.",
    });
  });

  it("does not treat display separators as a phone change", () => {
    expect(buildProfileUpdate({ name: "기존 이름", phone: "01012345678" }, "기존 이름", "010-1234-5678")).toEqual({});
    expect(buildProfileUpdate({ name: "기존 이름", phone: "+821012345678" }, "기존 이름", "+82 10-1234-5678")).toEqual({});
  });

  it("sends only the formatted phone when the number changed", () => {
    expect(buildProfileUpdate({ name: "기존 이름", phone: "01011112222" }, "기존 이름", "01033334444")).toEqual({ phone: "010-3333-4444" });
  });
});

describe("phone presentation", () => {
  it.each([
    [null, ""],
    [undefined, ""],
    ["", ""],
    ["0", "0"],
    ["01", "01"],
    ["010", "010"],
    ["0101", "010-1"],
    ["0101234", "010-1234"],
    ["01012345678", "010-1234-5678"],
    ["010-1234-5678", "010-1234-5678"],
    ["+82", "+82"],
    ["+8210", "+82 10"],
    ["+821012345678", "+82 10-1234-5678"],
    ["+82 10 1234 5678", "+82 10-1234-5678"],
    ["+82 10-1234-5678", "+82 10-1234-5678"],
    ["abc010-12한글34🙂5678", "010-1234-5678"],
  ])("formats %j as %j", (input, expected) => expect(formatPhoneForDisplay(input)).toBe(expected));

  it("normalizes only separators for comparison", () => {
    expect(normalizePhoneForComparison("010-1234-5678")).toBe("01012345678");
    expect(normalizePhoneForComparison("+82 10-1234-5678")).toBe("+821012345678");
  });

  it("accepts only complete domestic and +82 mobile numbers", () => {
    expect(validatePhone("010-1234-5678")).toBe(true);
    expect(validatePhone("+82 10-1234-5678")).toBe(true);
    expect(validatePhone("")).toBe(true);
    expect(validatePhone("010-1234")).toBe(false);
    expect(validatePhone("+82 10-1234")).toBe(false);
    expect(validatePhone("02-1234-5678")).toBe(false);
  });

  it("maps a middle-edit cursor by significant phone characters", () => {
    expect(phoneCursorPosition("01012394-5678", 6, "010-1239-4567")).toBe(7);
  });
});
