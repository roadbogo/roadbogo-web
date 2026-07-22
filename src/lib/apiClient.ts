import { AUTH_EXPIRED_KEY, clearClientAuth } from "@/lib/auth/authStorage";
import { getAccessToken, setAccessToken } from "@/lib/auth/accessToken";
import { API_V1_URL } from "@/lib/api";
import { PENDING_RETURN_TO_KEY, sanitizeInternalReturnTo } from "@/lib/auth/postLoginRouting";

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
  authEpoch?: number;
};

type AuthPhase = "ANONYMOUS" | "AUTHENTICATED" | "LOGGING_OUT";

let authEpoch = 0;
let authPhase: AuthPhase = "ANONYMOUS";
let refreshPromise: Promise<string> | null = null;
let refreshController: AbortController | null = null;
let refreshEpoch: number | null = null;
const protectedRequestControllers = new Set<AbortController>();

function abortProtectedRequests() {
  for (const controller of protectedRequestControllers) controller.abort();
  protectedRequestControllers.clear();
}

function cancelRefresh() {
  refreshController?.abort();
  refreshController = null;
  refreshPromise = null;
  refreshEpoch = null;
}

function advanceAuthEpoch(phase: AuthPhase, cancelActiveRefresh = true) {
  authEpoch += 1;
  authPhase = phase;
  abortProtectedRequests();
  if (cancelActiveRefresh) cancelRefresh();
  return authEpoch;
}

function sessionChanged(requestEpoch: number) {
  return requestEpoch !== authEpoch || authPhase === "LOGGING_OUT";
}

function createAuthAbortError() {
  return new DOMException("Authentication session changed.", "AbortError");
}

export function beginLoginAttempt() {
  clearClientAuth();
  return advanceAuthEpoch("ANONYMOUS");
}

export function completeLogin(token: string, loginEpoch = authEpoch) {
  if (sessionChanged(loginEpoch)) throw createAuthAbortError();
  advanceAuthEpoch("AUTHENTICATED");
  setAccessToken(token);
}

export function storeAccessToken(token: string) {
  setAccessToken(token);
}

export function resetAuthSession() {
  if (authPhase === "LOGGING_OUT") {
    clearClientAuth();
    return;
  }
  advanceAuthEpoch("ANONYMOUS");
  clearClientAuth();
}

export function finishLogoutSession() {
  advanceAuthEpoch("ANONYMOUS");
  clearClientAuth();
}

function expireSession(requestEpoch: number) {
  if (sessionChanged(requestEpoch)) return;
  resetAuthSession();
  sessionStorage.setItem(AUTH_EXPIRED_KEY, "true");
  const returnTo=sanitizeInternalReturnTo(`${window.location.pathname}${window.location.search??""}${window.location.hash??""}`);
  if(returnTo)sessionStorage.setItem(PENDING_RETURN_TO_KEY,returnTo);
  window.dispatchEvent(new Event("roadbogo:auth-expired"));
  if (window.location.pathname !== "/login") window.location.replace(`/login?reason=expired${returnTo?`&returnTo=${encodeURIComponent(returnTo)}`:""}`);
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try { return await response.json() as ApiEnvelope<T>; }
  catch { throw new ApiError("INVALID_API_RESPONSE", "서버 응답을 확인할 수 없습니다.", null, response.headers.get("X-Trace-ID"), response.status); }
}

export async function refreshAccessToken(expectedEpoch = authEpoch): Promise<string> {
  if (sessionChanged(expectedEpoch)) throw createAuthAbortError();
  if (refreshPromise && refreshEpoch !== expectedEpoch) throw createAuthAbortError();
  if (!refreshPromise) {
    const controller = new AbortController();
    const promise = (async () => {
      const response = await fetch(`${API_V1_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "X-Request-ID": crypto.randomUUID() },
        signal: controller.signal,
      });
      const envelope = await parseEnvelope<{ access_token: string }>(response);
      if (!response.ok || !envelope.success || !envelope.data?.access_token) {
        if (!envelope.success) throw new ApiError(envelope.error.code, envelope.error.message, envelope.error.details ?? null, envelope.trace_id, response.status);
        throw new ApiError("AUTH_REFRESH_FAILED", "로그인 세션을 갱신할 수 없습니다.", null, envelope.trace_id, response.status);
      }
      if (sessionChanged(expectedEpoch)) throw createAuthAbortError();
      setAccessToken(envelope.data.access_token);
      authPhase = "AUTHENTICATED";
      return envelope.data.access_token;
    })().finally(() => {
      if (refreshPromise === promise) {
        refreshPromise = null;
        refreshEpoch = null;
      }
      if (refreshController === controller) refreshController = null;
    });
    refreshController = controller;
    refreshEpoch = expectedEpoch;
    refreshPromise = promise;
  }
  return refreshPromise;
}

export function cancelPendingAuthRequests() {
  resetAuthSession();
}

function isUnauthorized(error: unknown): error is ApiError {
  return error instanceof ApiError && error.httpStatus === 401;
}

const refreshableAccessTokenErrors = new Set(["AUTH_ACCESS_TOKEN_EXPIRED", "AUTH_ACCESS_TOKEN_INVALID"]);

function shouldRefreshAuthentication<T>(response: Response, envelope: ApiEnvelope<T>) {
  return response.status === 401 && !envelope.success && refreshableAccessTokenErrors.has(envelope.error.code);
}

export function isAbortError(error: unknown) {
  return (
    typeof DOMException !== "undefined"
    && error instanceof DOMException
    && error.name === "AbortError"
  ) || (
    error instanceof Error
    && error.name === "AbortError"
  );
}

async function fetchWithAuthTracking(url: string, init: RequestInit, auth: boolean) {
  if (!auth) return fetch(url, init);
  const controller = new AbortController();
  const suppliedSignal = init.signal;
  const abort = () => controller.abort();
  if (suppliedSignal?.aborted) controller.abort();
  else suppliedSignal?.addEventListener("abort", abort, { once: true });
  protectedRequestControllers.add(controller);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    protectedRequestControllers.delete(controller);
    suppliedSignal?.removeEventListener("abort", abort);
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith("/")) throw new Error("API path must start with '/'.");
  const { auth = true, retryAuth = true, idempotencyKey, authEpoch: suppliedEpoch, body, headers: suppliedHeaders, ...requestInit } = options;
  const requestEpoch = suppliedEpoch ?? authEpoch;
  if (auth && sessionChanged(requestEpoch)) throw createAuthAbortError();

  const headers = new Headers(suppliedHeaders);
  headers.set("X-Request-ID", crypto.randomUUID());
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  const requestAccessToken = auth ? getAccessToken() : null;
  if (requestAccessToken) headers.set("Authorization", `Bearer ${requestAccessToken}`);

  let requestBody = body as BodyInit | null | undefined;
  if (body && !(body instanceof FormData) && typeof body === "object" && !(body instanceof Blob)) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const response = await fetchWithAuthTracking(`${API_V1_URL}${path}`, {
    ...requestInit,
    headers,
    body: requestBody,
    credentials: options.credentials ?? "include",
  }, auth);
  const envelope = await parseEnvelope<T>(response);

  if (shouldRefreshAuthentication(response, envelope) && retryAuth && path !== "/auth/login" && path !== "/auth/refresh") {
    if (sessionChanged(requestEpoch)) throw createAuthAbortError();
    try {
      if (!getAccessToken() || getAccessToken() === requestAccessToken) await refreshAccessToken(requestEpoch);
    } catch (error) {
      if (!isAbortError(error)) expireSession(requestEpoch);
      throw error;
    }
    if (sessionChanged(requestEpoch)) throw createAuthAbortError();
    try {
      return await apiRequest<T>(path, { ...options, retryAuth: false, authEpoch: requestEpoch });
    } catch (error) {
      if (isUnauthorized(error)) expireSession(requestEpoch);
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
  const pendingRefresh = refreshPromise;
  advanceAuthEpoch("LOGGING_OUT", false);
  clearClientAuth();
  if (pendingRefresh) {
    try { await pendingRefresh; }
    catch { /* The cookie-based logout remains safe and idempotent. */ }
  }
  return apiRequest<null>("/auth/logout", { method: "POST", auth: false, retryAuth: false });
}

export function createIdempotencyKey() { return crypto.randomUUID(); }
