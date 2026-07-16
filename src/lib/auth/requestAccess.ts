import type { AccessRequestPayload, AccessRequestResult } from "@/types/accessRequest";

export class AccessRequestError extends Error {
  constructor(public readonly code: "DUPLICATE" | "NETWORK") {
    super(code);
  }
}
export async function requestRoadbogoAccess(
  payload: AccessRequestPayload,
): Promise<AccessRequestResult> {
  await new Promise((resolve) => setTimeout(resolve, 850));

  if (payload.email === "existing@roadbogo.kr") throw new AccessRequestError("DUPLICATE");
  if (payload.email === "error@roadbogo.kr") throw new AccessRequestError("NETWORK");

  const submittedAt = new Date();
  const date = submittedAt.toISOString().slice(0, 10).replaceAll("-", "");
  const sequence = String(submittedAt.getTime() % 10000).padStart(4, "0");

  return {
    request_id: `REQ-${date}-${sequence}`,
    status: "PENDING",
    submitted_at: submittedAt.toISOString(),
  };
}
