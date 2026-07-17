import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAuthRestoreError } from "./AuthContext";
import { beginLoginAttempt, completeLogin, resetAuthSession } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/auth/accessToken";

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

  it("resets authentication and clears the user for a regular restore error", async () => {
    const clearUser = vi.fn();
    completeLogin("existing-token");

    handleAuthRestoreError(new Error("refresh failed"), true, clearUser);

    expect(clearUser).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBeNull();
  });
});
