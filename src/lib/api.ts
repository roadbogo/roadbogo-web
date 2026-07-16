export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const API_V1_URL = `${API_BASE_URL}/api/v1`;
export const AI_BASE_URL = (process.env.NEXT_PUBLIC_AI_BASE_URL ?? "http://localhost:8010").replace(/\/$/, "");

export const endpoints = {
  api: { health: `${API_V1_URL}/health` },
  ai: { health: `${AI_BASE_URL}/health` },
};
