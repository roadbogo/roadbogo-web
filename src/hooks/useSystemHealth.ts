"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SystemHealthResponse, SystemHealthStatus } from "@/types/systemHealth";

const offlineResult = (): SystemHealthResponse => ({ status: "offline", api: false, database: false, checkedAt: new Date().toISOString() });
const validStatuses: SystemHealthStatus[] = ["healthy", "degraded", "offline"];

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealthResponse>(() => offlineResult());
  const [isLoading, setIsLoading] = useState(true);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/system-health", { cache: "no-store", signal: controller.current.signal });
      if (!response.ok) throw new Error("health request failed");
      const data = await response.json() as SystemHealthResponse;
      if (!validStatuses.includes(data.status) || typeof data.api !== "boolean" || typeof data.database !== "boolean") throw new Error("invalid health response");
      const checkedAt = typeof data.checkedAt === "string" && !Number.isNaN(Date.parse(data.checkedAt)) ? data.checkedAt : new Date().toISOString();
      if (mounted.current) setHealth({ ...data, checkedAt });
    } catch (error) {
      if (mounted.current && !(error instanceof DOMException && error.name === "AbortError")) setHealth(offlineResult());
    } finally {
      inFlight.current = false;
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { mounted.current = false; controller.current?.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refresh]);

  return { ...health, isLoading, refresh };
}
