import { ACCESS_TOKEN_KEY, clearClientAuth } from "@/lib/auth/authStorage";
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

function readAccessToken() {
  return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

function expireSession() {
  clearClientAuth();
  window.dispatchEvent(new Event("roadbogo:auth-expired"));
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try { return await response.json() as ApiEnvelope<T>; }
  catch { throw new ApiError("INVALID_API_RESPONSE", "서버 응답을 확인할 수 없습니다.", null, response.headers.get("X-Trace-ID"), response.status); }
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_V1_URL}/auth/refresh`, { method: "POST", credentials: "include", headers: { "X-Request-ID": crypto.randomUUID() } });
      const envelope = await parseEnvelope<{ access_token: string }>(response);
      if (!response.ok || !envelope.success || !envelope.data?.access_token) {
        if (!envelope.success) throw new ApiError(envelope.error.code, envelope.error.message, envelope.error.details ?? null, envelope.trace_id, response.status);
        throw new ApiError("AUTH_REFRESH_FAILED", "로그인 세션을 갱신할 수 없습니다.", null, envelope.trace_id, response.status);
      }
      storeAccessToken(envelope.data.access_token);
      return envelope.data.access_token;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith("/")) throw new Error("API path must start with '/'.");
  const { auth = true, retryAuth = true, idempotencyKey, body, headers: suppliedHeaders, ...requestInit } = options;
  const headers = new Headers(suppliedHeaders);
  headers.set("X-Request-ID", crypto.randomUUID());
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  if (auth) {
    const token = readAccessToken();
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
    try { await refreshAccessToken(); return apiRequest<T>(path, { ...options, retryAuth: false }); }
    catch (error) { expireSession(); throw error; }
  }
  if (!response.ok || !envelope.success) {
    if (!envelope.success) throw new ApiError(envelope.error.code, envelope.error.message, envelope.error.details ?? null, envelope.trace_id, response.status);
    throw new ApiError("HTTP_ERROR", "요청을 처리할 수 없습니다.", null, envelope.trace_id, response.status);
  }
  return envelope.data;
}

export function createIdempotencyKey() { return crypto.randomUUID(); }
