import { ApiError,apiRequest } from "@/lib/apiClient";
import { buildDispatchListQuery } from "./dispatchDomain";
import { mapDispatchDetail,mapDispatchPage } from "./dispatchMapper";
import type { DispatchAcceptDataDto,DispatchActionFile,DispatchActionFilePurpose,DispatchActionReport,DispatchActionResult,DispatchAdapter,DispatchCommandResult,DispatchCompletionDataDto,DispatchDetail,DispatchDetailDto,DispatchListQuery,DispatchMineDataDto,DispatchProgressDataDto,DispatchRejectDataDto } from "./dispatchTypes";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const refreshCodes=new Set(["DISPATCH_VERSION_CONFLICT","DISPATCH_INVALID_STATE_TRANSITION","DISPATCH_IDEMPOTENCY_CONFLICT","INCIDENT_INVALID_STATE_TRANSITION"]);
export class ApiDispatchAdapter implements DispatchAdapter{
 readonly mode="api" as const;
 private reports=new Map<string,DispatchActionReport>();
 list(query:DispatchListQuery={}){return apiRequest<DispatchMineDataDto>(`/dispatches/mine?${buildDispatchListQuery(query)}`).then(mapDispatchPage)}
 async detail(publicId:string):Promise<DispatchDetail|null>{if(!uuid.test(publicId))throw new Error("INVALID_DISPATCH_PUBLIC_ID");try{return mapDispatchDetail(await apiRequest<DispatchDetailDto>(`/dispatches/${encodeURIComponent(publicId)}`))}catch(error){if(error instanceof ApiError&&error.httpStatus===404)return null;throw error}}
 async accept(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.command(publicId,versionNo,idempotencyKey,"accept",current)}
 async reject(publicId:string,versionNo:number,reason:string,idempotencyKey:string,current?:DispatchDetail){return this.command(publicId,versionNo,idempotencyKey,"reject",current,reason)}
 async depart(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.progress(publicId,versionNo,idempotencyKey,"depart",current)}
 async markEnRoute(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.progress(publicId,versionNo,idempotencyKey,"en-route",current)}
 async arrive(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.progress(publicId,versionNo,idempotencyKey,"arrive",current)}
 async startAction(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.progress(publicId,versionNo,idempotencyKey,"start-action",current)}
 async getActionReport(publicId:string):Promise<DispatchActionReport|null>{return this.reports.get(publicId)??null}
 async saveActionReport(publicId:string,detail:string,versionNo:number,key:string,current:DispatchDetail):Promise<DispatchActionResult>{
  void key;if(current.publicId!==publicId)return{ok:false,code:"DISPATCH_NOT_FOUND",latest:null};if(current.status!=="ACTION_IN_PROGRESS")return{ok:false,code:"DISPATCH_INVALID_STATE_TRANSITION",latest:current};if(current.versionNo!==versionNo)return{ok:false,code:"DISPATCH_VERSION_CONFLICT",latest:current};const report:DispatchActionReport={detail:detail.trim(),files:this.reports.get(publicId)?.files??[],savedAt:new Date().toISOString(),completedAt:null};this.reports.set(publicId,report);return{ok:true,report,detail:current}
 }
 async uploadActionFile(file:File,purpose:DispatchActionFilePurpose,clientFileId:string,key:string):Promise<{filePublicId:string}>{void file;void purpose;void clientFileId;void key;throw new Error("DISPATCH_ACTION_FILES_UNSUPPORTED")}
 async linkActionFile(publicId:string,filePublicId:string,purpose:DispatchActionFilePurpose,displayOrder:number,key:string):Promise<DispatchActionFile>{void publicId;void filePublicId;void purpose;void displayOrder;void key;throw new Error("DISPATCH_ACTION_FILES_UNSUPPORTED")}
 async completeAction(publicId:string,versionNo:number,key:string,current:DispatchDetail):Promise<DispatchActionResult>{const report=this.reports.get(publicId);if(!report)return{ok:false,code:"DISPATCH_ACTION_REPORT_REQUIRED",latest:current};try{const response=await apiRequest<DispatchCompletionDataDto>(`/dispatches/${encodeURIComponent(publicId)}/complete-action`,{method:"POST",idempotencyKey:key,body:{expected_version_no:versionNo,action_type:"현장 조치",action_detail:report.detail}});const detail={...current,status:response.dispatch.status,versionNo:response.dispatch.version_no,actionCompletedAt:response.dispatch.action_completed_at,incident:{...current.incident,status:response.incident.status},incidentVersionNo:response.incident.version_no};const completed={...report,detail:response.report.action_detail,completedAt:response.report.action_completed_at};this.reports.set(publicId,completed);return{ok:true,report:completed,detail}}catch(error){return this.actionFailure(publicId,error)}}
 private async actionFailure(publicId:string,error:unknown):Promise<Extract<DispatchActionResult,{ok:false}>>{if(error instanceof ApiError){let latest:DispatchDetail|null=null;if(refreshCodes.has(error.code)){try{latest=await this.detail(publicId)}catch{latest=null}}return{ok:false,code:error.code||String(error.httpStatus),latest}}throw error}
 private mergeCommand(base:DispatchDetail,response:DispatchAcceptDataDto|DispatchRejectDataDto|DispatchProgressDataDto):DispatchDetail{
  const common={...base,status:response.dispatch.status,versionNo:response.dispatch.version_no,incident:{...base.incident,status:response.incident.status},incidentVersionNo:response.incident.version_no};
  if("rejection_reason" in response.dispatch)return{...common,rejectionReason:response.dispatch.rejection_reason};
  if("accepted_at" in response.dispatch)return{...common,acceptedAt:response.dispatch.accepted_at};
  const occurred=response.dispatch.occurred_at;
  if(response.dispatch.status==="DEPARTED")return{...common,departedAt:occurred};
  if(response.dispatch.status==="EN_ROUTE")return{...common,enRouteAt:occurred};
  if(response.dispatch.status==="ARRIVED")return{...common,arrivedAt:occurred};
  return{...common,actionStartedAt:occurred};
 }
 private async command(publicId:string,versionNo:number,key:string,action:"accept"|"reject",current?:DispatchDetail,reason?:string):Promise<DispatchCommandResult>{
  if(!uuid.test(publicId))throw new Error("INVALID_DISPATCH_PUBLIC_ID");if(!Number.isInteger(versionNo)||versionNo<0)throw new Error("INVALID_DISPATCH_VERSION");
  const send=()=>apiRequest<DispatchAcceptDataDto|DispatchRejectDataDto>(`/dispatches/${encodeURIComponent(publicId)}/${action}`,{method:"POST",idempotencyKey:key,body:action==="accept"?{expected_version_no:versionNo}:{expected_version_no:versionNo,rejection_reason:reason}});
  let response:DispatchAcceptDataDto|DispatchRejectDataDto;
  try{try{response=await send()}catch(error){if(!(error instanceof TypeError))throw error;response=await send()}}
  catch(error){if(error instanceof ApiError){let latest:DispatchDetail|null=null;if(refreshCodes.has(error.code)){try{latest=await this.detail(publicId)}catch{latest=null}}return{ok:false,code:error.code||String(error.httpStatus),latest}}throw error}
  try{const latest=await this.detail(publicId);if(latest)return{ok:true,detail:this.mergeCommand(latest,response)}}catch{}
  if(current)return{ok:true,detail:this.mergeCommand(current,response),syncWarning:"DETAIL_REFRESH_FAILED"};
  throw new Error("DISPATCH_REFRESH_FAILED_WITHOUT_LOCAL_DETAIL");
 }
 private async progress(publicId:string,versionNo:number,key:string,action:"depart"|"en-route"|"arrive"|"start-action",current?:DispatchDetail):Promise<DispatchCommandResult>{
  if(!uuid.test(publicId))throw new Error("INVALID_DISPATCH_PUBLIC_ID");if(!Number.isInteger(versionNo)||versionNo<0)throw new Error("INVALID_DISPATCH_VERSION");
  const send=()=>apiRequest<DispatchProgressDataDto>(`/dispatches/${encodeURIComponent(publicId)}/${action}`,{method:"POST",idempotencyKey:key,body:{expected_version_no:versionNo}});
  let response:DispatchProgressDataDto;
  try{try{response=await send()}catch(error){if(!(error instanceof TypeError))throw error;response=await send()}}
  catch(error){if(error instanceof ApiError){let latest:DispatchDetail|null=null;if(refreshCodes.has(error.code)){try{latest=await this.detail(publicId)}catch{latest=null}}return{ok:false,code:error.code||String(error.httpStatus),latest}}throw error}
  try{const latest=await this.detail(publicId);if(latest)return{ok:true,detail:this.mergeCommand(latest,response)}}catch{}
  if(current)return{ok:true,detail:this.mergeCommand(current,response),syncWarning:"DETAIL_REFRESH_FAILED"};
  throw new Error("DISPATCH_REFRESH_FAILED_WITHOUT_LOCAL_DETAIL");
 }
}
