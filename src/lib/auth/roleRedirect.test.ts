import { describe, expect, it } from "vitest";
import { getPrimaryRole } from "./roleRedirect";
import type { UserRole } from "@/types/auth";

describe("getPrimaryRole", () => {
  it.each([
    [["GENERAL_USER"], "GENERAL_USER"],
    [["CONTROLLER"], "CONTROLLER"],
    [["GENERAL_USER", "RESPONDER"], "RESPONDER"],
    [["CONTROLLER", "CONTROL_MANAGER"], "CONTROL_MANAGER"],
    [["RESPONDER", "SYSTEM_ADMIN"], "SYSTEM_ADMIN"],
    [[], "GENERAL_USER"],
  ] satisfies Array<[UserRole[], UserRole]>)("selects the primary role from %j", (roles, expected) => {
    expect(getPrimaryRole(roles)).toBe(expected);
  });

  it("does not depend on the API role order", () => {
    expect(getPrimaryRole(["GENERAL_USER", "CONTROL_MANAGER", "CONTROLLER"])).toBe("CONTROL_MANAGER");
    expect(getPrimaryRole(["CONTROLLER", "GENERAL_USER", "CONTROL_MANAGER"])).toBe("CONTROL_MANAGER");
  });
});
