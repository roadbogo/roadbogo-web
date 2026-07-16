import type { UserRole } from "@/types/auth";

export type OperationRequestRole = Extract<UserRole, "CONTROL_MANAGER" | "CONTROLLER" | "RESPONDER">;
export type OperationAccessRequest = { applicantName:string; organizationName:string; email:string; phone:string; requestedRole:OperationRequestRole; reason:string; privacyAgreed:true };
export type OperationAccessResult = { requestId:string; status:"PENDING" };

export class OperationAccessApiUnavailableError extends Error {
  constructor() { super("운영 계정 신청 API가 아직 연결되지 않았습니다."); this.name = "OperationAccessApiUnavailableError"; }
}

export const operationAccessApi = {
  async submit(request: OperationAccessRequest): Promise<OperationAccessResult> {
    void request;
    throw new OperationAccessApiUnavailableError();
  },
};
