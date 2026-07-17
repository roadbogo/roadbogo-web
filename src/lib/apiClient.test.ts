import { beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function response(status: number, data: unknown = null) {
  return new Response(JSON.stringify(status >= 200 && status < 300
    ? { success: true, data, trace_id: "trace" }
    : { success: false, error: { code: `HTTP_${status}`, message: "failed" }, trace_id: "trace" }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
  vi.resetModules();
  vi.stubGlobal("localStorage", createStorage());
  vi.stubGlobal("sessionStorage", createStorage());
  vi.stubGlobal("window", {
    dispatchEvent: vi.fn(),
    location: { pathname: "/private", replace: vi.fn() },
  });
  vi.stubGlobal("fetch", vi.fn());
});

describe("apiClient authentication races", () => {
  it("uses one refresh for simultaneous 401 responses and retries each request once", async () => {
    const api = await import("./apiClient");
    api.completeLogin("old-token");
    let resourceCalls = 0;
    let refreshCalls = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return response(200, { access_token: "new-token" });
      }
      resourceCalls += 1;
      return resourceCalls <= 2 ? response(401) : response(200, { ok: true });
    });

    await expect(Promise.all([api.apiRequest("/one"), api.apiRequest("/two")])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(resourceCalls).toBe(4);
  });

  it("expires the session when the single retry is also unauthorized", async () => {
    const api = await import("./apiClient");
    api.completeLogin("old-token");
    vi.mocked(fetch).mockImplementation(async (input) => String(input).endsWith("/auth/refresh")
      ? response(200, { access_token: "new-token" })
      : response(401));

    await expect(api.apiRequest("/private")).rejects.toMatchObject({ httpStatus: 401 });
    expect(sessionStorage.getItem("roadbogo_auth_expired")).toBe("true");
    expect(window.location.replace).toHaveBeenCalledWith("/login?reason=expired");
  });

  it("does not restore a token when logout starts during refresh", async () => {
    const api = await import("./apiClient");
    api.completeLogin("old-token");
    const refresh = deferred<Response>();
    let resourceCalls = 0;
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return refresh.promise;
      if (url.endsWith("/auth/logout")) return Promise.resolve(response(200));
      resourceCalls += 1;
      return Promise.resolve(response(401));
    });

    const request = api.apiRequest("/private");
    await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/auth/refresh"))).toBe(true));
    const logout = api.logoutWithRefreshRetry();
    refresh.resolve(response(200, { access_token: "late-token" }));

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    await expect(logout).resolves.toBeNull();
    expect(resourceCalls).toBe(1);
    expect((await import("./auth/accessToken")).getAccessToken()).toBeNull();
  });

  it("never retries an old-account request with a new account token", async () => {
    const api = await import("./apiClient");
    api.completeLogin("account-a");
    const oldResponse = deferred<Response>();
    let resourceCalls = 0;
    vi.mocked(fetch).mockImplementation((input) => {
      if (String(input).endsWith("/private")) {
        resourceCalls += 1;
        return oldResponse.promise;
      }
      return Promise.resolve(response(200));
    });

    const oldRequest = api.apiRequest("/private", { method: "POST", body: { change: true } });
    api.beginLoginAttempt();
    api.completeLogin("account-b");
    oldResponse.resolve(response(401));

    await expect(oldRequest).rejects.toMatchObject({ name: "AbortError" });
    expect(resourceCalls).toBe(1);
    expect((await import("./auth/accessToken")).getAccessToken()).toBe("account-b");
    expect(sessionStorage.getItem("roadbogo_auth_expired")).toBeNull();
  });

  it("does not refresh or expire for a 401 arriving during logout", async () => {
    const api = await import("./apiClient");
    api.completeLogin("old-token");
    const oldResponse = deferred<Response>();
    let refreshCalls = 0;
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return Promise.resolve(response(200, { access_token: "unexpected" }));
      }
      if (url.endsWith("/auth/logout")) return Promise.resolve(response(200));
      return oldResponse.promise;
    });

    const request = api.apiRequest("/private");
    const logout = api.logoutWithRefreshRetry();
    oldResponse.resolve(response(401));

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    await expect(logout).resolves.toBeNull();
    expect(refreshCalls).toBe(0);
    expect(sessionStorage.getItem("roadbogo_auth_expired")).toBeNull();
  });

  it("does not let an old refresh finally clear a newer refresh", async () => {
    const api = await import("./apiClient");
    const oldRefresh = deferred<Response>();
    const newRefresh = deferred<Response>();
    let refreshCalls = 0;
    vi.mocked(fetch).mockImplementation((input) => {
      if (!String(input).endsWith("/auth/refresh")) return Promise.resolve(response(200));
      refreshCalls += 1;
      return refreshCalls === 1 ? oldRefresh.promise : newRefresh.promise;
    });

    const first = api.refreshAccessToken();
    api.beginLoginAttempt();
    api.completeLogin("account-b");
    const second = api.refreshAccessToken();
    oldRefresh.resolve(response(200, { access_token: "account-a-late" }));
    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    const joined = api.refreshAccessToken();
    newRefresh.resolve(response(200, { access_token: "account-b-refreshed" }));

    await expect(Promise.all([second, joined])).resolves.toEqual(["account-b-refreshed", "account-b-refreshed"]);
    expect(refreshCalls).toBe(2);
  });

  it.each([403, 404, 409, 422])("preserves a %i API error without expiring the session", async (status) => {
    const api = await import("./apiClient");
    api.completeLogin("token");
    vi.mocked(fetch).mockResolvedValue(response(status));

    await expect(api.apiRequest("/private")).rejects.toMatchObject({ httpStatus: status });
    expect(sessionStorage.getItem("roadbogo_auth_expired")).toBeNull();
    expect(window.location.replace).not.toHaveBeenCalled();
  });
});
