const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const aiBaseUrl = process.env.NEXT_PUBLIC_AI_BASE_URL ?? "http://localhost:8010";

export const endpoints = {
  api: {
    health: `${apiBaseUrl}/health`
  },
  ai: {
    health: `${aiBaseUrl}/health`
  }
};
