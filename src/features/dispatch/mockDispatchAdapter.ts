import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { updateMockFieldActionRuntime } from "@/features/control-dashboard/mockFieldActionRuntime";
import { updateMockDispatchRuntime,updateMockIncidentRuntime } from "@/features/control-dashboard/mockIncidentRuntimeState";
import { activeDispatchStatuses } from "./dispatchDomain";
import type { DispatchActionFilePurpose,DispatchActionReport,DispatchActionResult,DispatchAdapter, DispatchCommandResult, DispatchDetail, DispatchListQuery } from "./dispatchTypes";

function records(): DispatchDetail[] {
  const snapshot = createMockDashboardSnapshot();
  return snapshot.dispatches.map((dispatch, index) => {
    const incident = snapshot.incidents.find((item) => item.public_id === dispatch.incident_public_id)!;
    const cctv = snapshot.cctvs.find((item) => item.public_id === incident.cctv_public_id)!;
    return {
      publicId: dispatch.public_id,
      attemptNo: 1,
      status: dispatch.status,
      requestMessage: "현장 확인 및 조치를 요청합니다.",
      requestedAt: dispatch.requested_at,
      acceptedAt: dispatch.status === "REQUESTED" ? null : dispatch.updated_at,
      versionNo: index,
      incident: {
        publicId: incident.public_id,
        incidentNo: incident.incident_no,
        status: incident.status,
        objectCategory: incident.object_category,
        riskGrade: incident.current_risk_grade,
        cctvName: cctv.cctv_name,
        roadName: cctv.road.road_name,
        roadSectionName: cctv.road_section.section_name,
        latitude: 37.5,
        longitude: 127.1,
      },
      assignedBy: { publicId: "33333333-3333-4333-8333-333333333333", name: "관제 담당자" },
      rejectionReason: null, departedAt: null, enRouteAt: null, arrivedAt: null,
      actionStartedAt: null, actionCompletedAt: null, cancelledAt: null, previousDispatchPublicId: null,
    };
  });
}

export class MockDispatchAdapter implements DispatchAdapter {
  readonly mode = "mock" as const;
  private data = records();
  private reports=new Map<string,DispatchActionReport>();
  private uploadedFiles=new Map<string,string>();
  async list(query: DispatchListQuery = {}) {
    const page = query.page ?? 1, size = query.size ?? 20, activeOnly = query.activeOnly ?? true;
    let items = this.data.filter((item) => !activeOnly || activeDispatchStatuses.includes(item.status));
    if (query.status) items = items.filter((item) => item.status === query.status);
    return { items: items.slice((page - 1) * size, page * size), pagination: { page, size, totalElements: items.length, totalPages: Math.ceil(items.length / size) } };
  }
  async detail(publicId: string) { return this.data.find((item) => item.publicId === publicId) ?? null; }
  async accept(publicId: string, versionNo: number, key: string) { return this.update(publicId, versionNo, "ACCEPTED", key); }
  async reject(publicId: string, versionNo: number, reason: string, key: string) { return this.update(publicId, versionNo, "REJECTED", key, reason); }
  async depart(publicId:string,versionNo:number,key:string){return this.progress(publicId,versionNo,"ACCEPTED","DEPARTED","departedAt",key)}
  async markEnRoute(publicId:string,versionNo:number,key:string){return this.progress(publicId,versionNo,"DEPARTED","EN_ROUTE","enRouteAt",key)}
  async arrive(publicId:string,versionNo:number,key:string){return this.progress(publicId,versionNo,"EN_ROUTE","ARRIVED","arrivedAt",key)}
  async startAction(publicId:string,versionNo:number,key:string){return this.progress(publicId,versionNo,"ARRIVED","ACTION_IN_PROGRESS","actionStartedAt",key)}
  async getActionReport(publicId:string){return this.reports.get(publicId)??null}
  async saveActionReport(publicId:string,detail:string,versionNo:number,key:string,current:DispatchDetail):Promise<DispatchActionResult>{void key;const stored=await this.detail(publicId);if(!stored)return{ok:false,code:"DISPATCH_NOT_FOUND",latest:null};if(stored.status!=="ACTION_IN_PROGRESS")return{ok:false,code:"DISPATCH_INVALID_STATE_TRANSITION",latest:stored};if(stored.versionNo!==versionNo)return{ok:false,code:"DISPATCH_VERSION_CONFLICT",latest:stored};const report:DispatchActionReport={detail:detail.trim(),files:this.reports.get(publicId)?.files??[],savedAt:new Date().toISOString(),completedAt:null};this.reports.set(publicId,report);return{ok:true,report,detail:current}}
  async uploadActionFile(file:File,_purpose:DispatchActionFilePurpose,clientFileId:string,key:string){void key;const filePublicId=`mock-file-${clientFileId}`;this.uploadedFiles.set(filePublicId,URL.createObjectURL?.(file)??"");return{filePublicId}}
  async linkActionFile(publicId:string,filePublicId:string,purpose:DispatchActionFilePurpose,displayOrder:number,key:string){void key;const report=this.reports.get(publicId);if(!report)throw new Error("DISPATCH_ACTION_REPORT_REQUIRED");const linked={filePublicId,purpose,displayOrder,fileName:filePublicId,previewUrl:this.uploadedFiles.get(filePublicId)??null};this.reports.set(publicId,{...report,files:[...report.files.filter(file=>file.filePublicId!==filePublicId),linked]});return linked}
  async completeAction(publicId:string,versionNo:number,key:string,current:DispatchDetail):Promise<DispatchActionResult>{void key;const stored=await this.detail(publicId);const report=this.reports.get(publicId);if(!stored)return{ok:false,code:"DISPATCH_NOT_FOUND",latest:null};if(!report)return{ok:false,code:"DISPATCH_ACTION_REPORT_REQUIRED",latest:stored};if(stored.status!=="ACTION_IN_PROGRESS")return{ok:false,code:"DISPATCH_INVALID_STATE_TRANSITION",latest:stored};if(stored.versionNo!==versionNo)return{ok:false,code:"DISPATCH_VERSION_CONFLICT",latest:stored};const completedAt=new Date().toISOString(),next={...current,status:"ACTION_COMPLETED" as const,versionNo:versionNo+1,actionCompletedAt:completedAt,incident:{...current.incident,status:"ACTION_COMPLETED" as const}};this.data=this.data.map(item=>item.publicId===publicId?next:item);const completed={...report,completedAt};this.reports.set(publicId,completed);const dashboardDispatch=createMockDashboardSnapshot().dispatches.find(item=>item.public_id===publicId);updateMockIncidentRuntime(current.incident.publicId,{status:"ACTION_COMPLETED",updated_at:completedAt,version_no:(current.incidentVersionNo??0)+1});updateMockDispatchRuntime({public_id:publicId,incident_public_id:current.incident.publicId,status:"ACTION_COMPLETED",responder_label:dashboardDispatch?.responder_label??"출동 담당자",requested_at:current.requestedAt,updated_at:completedAt});updateMockFieldActionRuntime({incidentPublicId:current.incident.publicId,dispatchPublicId:publicId,responderLabel:dashboardDispatch?.responder_label??"출동 담당자",actionType:"현장 조치",detail:completed.detail,completedAt,beforeImageUrl:completed.files.find(file=>file.purpose==="ACTION_BEFORE")?.previewUrl??null,afterImageUrl:completed.files.find(file=>file.purpose==="ACTION_AFTER")?.previewUrl??null});return{ok:true,report:completed,detail:next}}
  private async update(publicId: string, versionNo: number, status: "ACCEPTED" | "REJECTED", key: string, reason?: string): Promise<DispatchCommandResult> {
    void key;
    const current = await this.detail(publicId);
    if (!current) return { ok: false, code: "DISPATCH_NOT_FOUND", latest: null };
    if (current.versionNo !== versionNo) return { ok: false, code: "DISPATCH_VERSION_CONFLICT", latest: current };
    if (current.status !== "REQUESTED") return { ok: false, code: "DISPATCH_INVALID_STATE_TRANSITION", latest: current };
    const next: DispatchDetail = { ...current, status, versionNo: current.versionNo + 1, acceptedAt: status === "ACCEPTED" ? new Date().toISOString() : null, rejectionReason: reason ?? null };
    this.data = this.data.map((item) => item.publicId === publicId ? next : item);
    return { ok: true, detail: next };
  }
  private async progress(publicId:string,versionNo:number,from:DispatchDetail["status"],to:DispatchDetail["status"],timestamp:"departedAt"|"enRouteAt"|"arrivedAt"|"actionStartedAt",key:string):Promise<DispatchCommandResult>{
    void key;
    const current=await this.detail(publicId);
    if(!current)return{ok:false,code:"DISPATCH_NOT_FOUND",latest:null};
    if(current.versionNo!==versionNo)return{ok:false,code:"DISPATCH_VERSION_CONFLICT",latest:current};
    if(current.status!==from)return{ok:false,code:"DISPATCH_INVALID_STATE_TRANSITION",latest:current};
    const incidentStatus=to==="ARRIVED"?"ON_SCENE":to==="ACTION_IN_PROGRESS"?"ACTION_IN_PROGRESS":current.incident.status;
    const next:DispatchDetail={...current,status:to,versionNo:current.versionNo+1,[timestamp]:new Date().toISOString(),incident:{...current.incident,status:incidentStatus}};
    this.data=this.data.map(item=>item.publicId===publicId?next:item);
    return{ok:true,detail:next};
  }
}
