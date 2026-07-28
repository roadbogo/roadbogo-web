import { describe, expect, it } from "vitest";
import { isPasswordValid } from "./passwordPolicy";
import { authenticateMockAccount } from "./mockAccounts";

describe("local control manager account",()=>{
  it("uses the policy-compliant development password",()=>{
    const result=authenticateMockAccount("manager@roadbogo.kr","ManagerRoad2026");
    expect(isPasswordValid("ManagerRoad2026")).toBe(true);
    expect(result.ok&&result.user.roles).toEqual(["CONTROL_MANAGER"]);
  });

  it("no longer accepts the obsolete numeric-only password",()=>{
    expect(authenticateMockAccount("manager@roadbogo.kr","1234")).toEqual({ok:false,reason:"invalid_password"});
  });
});
