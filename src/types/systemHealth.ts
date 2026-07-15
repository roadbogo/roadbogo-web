export type SystemHealthStatus = "healthy" | "degraded" | "offline";

export type SystemHealthResponse = {
  status: SystemHealthStatus;
  api: boolean;
  database: boolean;
  checkedAt: string;
};
