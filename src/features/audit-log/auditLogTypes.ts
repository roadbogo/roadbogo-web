export type AuditActorType="USER"|"SYSTEM"|"DEVICE";
export type AuditResult="SUCCESS"|"FAILURE"|"DENIED";
export type AuditResourceType="USER"|"ROLE"|"INCIDENT"|"DISPATCH"|"CCTV"|"SYSTEM";
export type AuditActionGroup="AUTH"|"ACCOUNT"|"ROLE_PERMISSION"|"INCIDENT_DISPATCH"|"CCTV_SYSTEM";
export type AuditRecord={
 publicId:string;traceId:string|null;occurredAt:string;actorType:AuditActorType;actorPublicId:string|null;actorLabel:string;
 actionCode:string;actionLabel:string;actionGroup:AuditActionGroup;resourceType:AuditResourceType;resourcePublicId:string|null;resourceLabel:string;
 result:AuditResult;reasonText:string|null;summary:string;before:Record<string,unknown>|null;after:Record<string,unknown>|null;requestIpHash:string|null;
};
export type AuditMode="trace"|"record";
export type AuditQuickFilter="ALL"|"FAILED"|"ACCOUNT"|"OPERATIONS"|"SYSTEM";
export type AuditQuery={mode:AuditMode;quick:AuditQuickFilter;period:"today"|"7d"|"30d";actorType:"ALL"|AuditActorType;actionGroup:"ALL"|AuditActionGroup;resourceType:"ALL"|AuditResourceType;result:"ALL"|AuditResult;keyword:string;page:number;size:10|20|50;traceId:string|null;auditId:string|null};
export type AuditFlow={id:string;traceId:string|null;occurredAt:string;actorLabel:string;actorType:AuditActorType;actionLabel:string;resourceLabel:string;resourceType:AuditResourceType;summary:string;recordCount:number;result:AuditResult;records:AuditRecord[]};
export type AuditSummary={total:number;success:number;failure:number;denied:number};
export type AuditListResult<T>={items:T[];total:number;page:number;size:number;summary:AuditSummary};
export interface AdminAuditLogRepository{getFlows(query:AuditQuery):Promise<AuditListResult<AuditFlow>>;getRecords(query:AuditQuery):Promise<AuditListResult<AuditRecord>>;getRecord(publicId:string):Promise<AuditRecord|null>;getTraceRecords(traceId:string):Promise<AuditRecord[]>}
