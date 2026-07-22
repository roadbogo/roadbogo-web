import { NextResponse } from "next/server";
import type { SystemHealthResponse } from "@/types/systemHealth";

const API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TIMEOUT_MS = 4000;

export function isHealthyResponse(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const response = body as { status?: unknown; success?: unknown; data?: unknown };
  if (response.status === "ok" || response.status === "UP") return true;
  if (response.success !== true || !response.data || typeof response.data !== "object") return false;
  return (response.data as { status?: unknown }).status === "UP";
}

async function isHealthy(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return isHealthyResponse(body);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const api = await isHealthy("/health");
  if (!api) {
    const result: SystemHealthResponse = { status: "offline", api: false, database: false, checkedAt };
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }

  const database = await isHealthy("/health/db");
  const result: SystemHealthResponse = { status: database ? "healthy" : "degraded", api: true, database, checkedAt };
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
