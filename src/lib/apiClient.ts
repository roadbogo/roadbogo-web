import { AUTH_EXPIRED_KEY, clearClientAuth } from "@/lib/auth/authStorage";
import { getAccessToken, setAccessToken } from "@/lib/auth/accessToken";
import { API_V1_URL } from "@/lib/api";

export type ApiSuccess<T> = { success: true; data: T; message?: string | null; trace_id: string };
export type ApiFailure = { success: false; error: { code: string; message: string; details?: Record<string, unknown> | null }; trace_id: string };
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export class ApiError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> | null, public traceId: string | null, public httpStatus: number) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
  auth?: boolean;
  retryAuth?: boolean;
  idempotencyKey?: string;
};

let refreshPromise: Promise<string> | null = null;
let refreshController: AbortController | null = null;
let refreshGeneration = 0;

export function storeAccessToken(token: string) {
  setAccessToken(token);
}

function expireSession() {
  clearClientAuth();
  sessionStorage.setItem(AUTH_EXPIRED_KEY, "true");
  window.dispatchEvent(new Event("roadbogo:auth-expired"));
  if (window.location.pathname !== "/login") window.location.replace("/login?reason=expired");
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try { return await response.json() as ApiEnvelope<T>; }
  catch { throw new ApiError("INVALID_API_RESPONSE", "서버 응답을 확인할 수 없습니다.", null, response.headers.get("X-Trace-ID"), response.status); }
}

export async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    const controller = new AbortController();
    const generation = refreshGeneration;
    const promise = (async () => {
      const response = await fetch(`${API_V1_URL}/auth/refresh`, { method: "POST", credentials: "include", headers: { "X-Request-ID": crypto.randomUUID() }, signal: controller.signal });
      const envelope = await parseEnvelope<{ access_token: string }>(response);
      if (!response.ok || !envelope.success || !envelope.data?.access_token) {
        if (!envelope.success) throw new ApiError(envelope.error.code, envelope.error.message, envelope.error.details ?? null, envelope.trace_id, response.status);
        throw new ApiError("AUTH_REFRESH_FAILED", "로그인 세션을 갱신할 수 없습니다.", null, envelope.trace_id, response.status);
      }
      if (generation !== refreshGeneration) throw new DOMException("Refresh request was cancelled.", "AbortError");
      setAccessToken(envelope.data.access_token);
      return envelope.data.access_token;
    })().finally(() => {
      if (refreshPromise === promise) refreshPromise = null;
      if (refreshController === controller) refreshController = null;
    });
    refreshController = controller;
    refreshPromise = promise;
  }
  return refreshPromise;
}

export function cancelPendingAuthRequests() {
  refreshGeneration += 1;
  refreshController?.abort();
  refreshController = null;
  refreshPromise = null;
}

function isUnauthorized(error: unknown): error is ApiError {
  return error instanceof ApiError && error.httpStatus === 401;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith("/")) throw new Error("API path must start with '/'.");
  const { auth = true, retryAuth = true, idempotencyKey, body, headers: suppliedHeaders, ...requestInit } = options;
  const headers = new Headers(suppliedHeaders);
  headers.set("X-Request-ID", crypto.randomUUID());
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  const requestAccessToken = auth ? getAccessToken() : null;
  if (auth) {
    const token = requestAccessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  let requestBody = body as BodyInit | null | undefined;
  if (body && !(body instanceof FormData) && typeof body === "object" && !(body instanceof Blob)) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }
  const response = await fetch(`${API_V1_URL}${path}`, { ...requestInit, headers, body: requestBody, credentials: options.credentials ?? "include" });
  const envelope = await parseEnvelope<T>(response);
  if (response.status === 401 && retryAuth && path !== "/auth/login" && path !== "/auth/refresh") {
    try {
      if (!getAccessToken() || getAccessToken() === requestAccessToken) await refreshAccessToken();
    } catch (error) {
      if (!isAbortError(error)) expireSession();
      throw error;
    }
    try {
      return await apiRequest<T>(path, { ...options, retryAuth: false });
    } catch (error) {
      if (isUnauthorized(error)) expireSession();
      throw error;
    }
  }
  if (!response.ok || !envelope.success) {
    if (!envelope.success) throw new ApiError(envelope.error.code, envelope.error.message, envelope.error.details ?? null, envelope.trace_id, response.status);
    throw new ApiError("HTTP_ERROR", "요청을 처리할 수 없습니다.", null, envelope.trace_id, response.status);
  }
  return envelope.data;
}

export async function logoutWithRefreshRetry(): Promise<null> {
  const requestAccessToken = getAccessToken();
  try {
    return await apiRequest<null>("/auth/logout", { method: "POST", retryAuth: false });
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
  }
  if (!getAccessToken() || getAccessToken() === requestAccessToken) await refreshAccessToken();
  return await apiRequest<null>("/auth/logout", { method: "POST", retryAuth: false });
}

export function createIdempotencyKey() { return crypto.randomUUID(); }
