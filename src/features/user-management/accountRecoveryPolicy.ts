import type {ManagedUser} from "./userManagementTypes";

export type AccountRecoveryEligibility="AVAILABLE"|"UNAVAILABLE"|"NEEDS_REVIEW";
export type AccountRecoveryResult={eligibility:AccountRecoveryEligibility;reason:string};

export function getAccountRecoveryEligibility(user:ManagedUser):AccountRecoveryResult{
  if(user.accountStatus!=="INACTIVE")return{eligibility:"UNAVAILABLE",reason:"활성 계정은 복구 대상이 아닙니다."};
  if(user.deletedAt||!user.userName.trim()||!user.email.trim())return{eligibility:"UNAVAILABLE",reason:"탈퇴 또는 익명화가 완료된 계정은 복구할 수 없습니다."};
  const hasAdministrativeRecord=Boolean(user.deactivatedAt)&&user.changes.some(change=>change.action.includes("비활성"));
  if(hasAdministrativeRecord)return{eligibility:"AVAILABLE",reason:"관리자 비활성화 기록과 사용자 식별 정보가 확인되었습니다."};
  return{eligibility:"NEEDS_REVIEW",reason:"관리자 비활성화인지 탈퇴 계정인지 판단할 기록이 부족합니다."};
}
