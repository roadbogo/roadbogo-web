import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAuthRestoreError, resolveAuthenticatedApiPermissions } from "./AuthContext";
import { beginLoginAttempt, completeLogin, resetAuthSession } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/auth/accessToken";
import {SYSTEM_ADMIN_API_PERMISSIONS} from "@/lib/auth/accessMapping";
import type {AuthUser} from "@/types/auth";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorage());
  vi.stubGlobal("sessionStorage", createStorage());
  resetAuthSession();
});

afterEach(() => {
  resetAuthSession();
  vi.unstubAllGlobals();
});

describe("AuthProvider startup restore errors", () => {
  it("preserves a newer login when the startup restore is aborted", async () => {
    const clearUser = vi.fn();
    const loginEpoch = beginLoginAttempt();

    completeLogin("new-login-token", loginEpoch);
    handleAuthRestoreError(Object.assign(new Error("superseded"), { name: "AbortError" }), true, clearUser);

    expect(clearUser).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("new-login-token");
    expect(() => completeLogin("newer-token")).not.toThrow();
    expect(getAccessToken()).toBe("newer-token");
  });

  it("keeps the login epoch valid when an older restore is aborted", async () => {
    const loginEpoch = beginLoginAttempt();

    handleAuthRestoreError(Object.assign(new Error("superseded"), { name: "AbortError" }), true, vi.fn());

    expect(() => completeLogin("new-login-token", loginEpoch)).not.toThrow();
  });

  it("does not reset auth from an inactive stale restore", () => {
    const clearUser = vi.fn();
    const loginEpoch = beginLoginAttempt();

    completeLogin("new-login-token", loginEpoch);

    handleAuthRestoreError(
      new Error("stale restore failed"),
      false,
      clearUser,
    );

    expect(clearUser).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("new-login-token");
    expect(() => completeLogin("newer-token")).not.toThrow();
  });

  it("resets authentication and clears the user for a regular restore error", async () => {
    const clearUser = vi.fn();
    completeLogin("existing-token");

    handleAuthRestoreError(new Error("refresh failed"), true, clearUser);

    expect(clearUser).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBeNull();
  });
});

const authUser=(roles:AuthUser["roles"],permissions:string[]):AuthUser=>({
  publicId:"mock-user",email:"mock@roadbogo.test",userName:"Mock 사용자",accountStatus:"ACTIVE",
  organization:null,roles,permissions,lastLoginAt:null,updatedAt:"2026-07-30T00:00:00Z",
});

describe("development mock SYSTEM_ADMIN permissions",()=>{
  it("fills an empty SYSTEM_ADMIN permission list only in development mock mode",()=>{
    expect(resolveAuthenticatedApiPermissions(authUser(["SYSTEM_ADMIN"],[]),"SYSTEM_ADMIN","development","true")).toEqual(SYSTEM_ADMIN_API_PERMISSIONS);
  });
  it("does not grant administrator permissions to another role",()=>{
    expect(resolveAuthenticatedApiPermissions(authUser(["CONTROLLER"],[]),"CONTROLLER","development","true")).toEqual([]);
  });
  it("does not fill empty permissions outside mock mode or development",()=>{
    const admin=authUser(["SYSTEM_ADMIN"],[]);
    expect(resolveAuthenticatedApiPermissions(admin,"SYSTEM_ADMIN","development","false")).toEqual([]);
    expect(resolveAuthenticatedApiPermissions(admin,"SYSTEM_ADMIN","production","true")).toEqual([]);
  });
  it("preserves existing server permissions without duplicates",()=>{
    expect(resolveAuthenticatedApiPermissions(authUser(["SYSTEM_ADMIN"],["USER.READ_ALL","USER.READ_ALL"]),"SYSTEM_ADMIN","development","true")).toEqual(["USER.READ_ALL"]);
  });
});
