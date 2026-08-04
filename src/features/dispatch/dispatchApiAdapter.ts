import { ApiError,apiRequest } from "@/lib/apiClient";
import { buildDispatchListQuery } from "./dispatchDomain";
import { mapDispatchDetail,mapDispatchPage } from "./dispatchMapper";
import type { DispatchAcceptDataDto,DispatchActionFile,DispatchActionFilePurpose,DispatchActionReport,DispatchActionResult,DispatchAdapter,DispatchCommandResult,DispatchDetail,DispatchDetailDto,DispatchListQuery,DispatchMineDataDto,DispatchProgressDataDto,DispatchRejectDataDto } from "./dispatchTypes";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const refreshCodes=new Set(["DISPATCH_VERSION_CONFLICT","DISPATCH_INVALID_STATE_TRANSITION","DISPATCH_IDEMPOTENCY_CONFLICT","INCIDENT_INVALID_STATE_TRANSITION"]);
export class ApiDispatchAdapter implements DispatchAdapter{
 readonly mode="api" as const;
 list(query:DispatchListQuery={}){return apiRequest<DispatchMineDataDto>(`/dispatches/mine?${buildDispatchListQuery(query)}`).then(mapDispatchPage)}
 async detail(publicId:string):Promise<DispatchDetail|null>{if(!uuid.test(publicId))throw new Error("INVALID_DISPATCH_PUBLIC_ID");try{return mapDispatchDetail(await apiRequest<DispatchDetailDto>(`/dispatches/${encodeURIComponent(publicId)}`))}catch(error){if(error instanceof ApiError&&error.httpStatus===404)return null;throw error}}
 async accept(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.command(publicId,versionNo,idempotencyKey,"accept",current)}
 async reject(publicId:string,versionNo:number,reason:string,idempotencyKey:string,current?:DispatchDetail){return this.command(publicId,versionNo,idempotencyKey,"reject",current,reason)}
 async depart(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.progress(publicId,versionNo,idempotencyKey,"depart",current)}
 async markEnRoute(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.progress(publicId,versionNo,idempotencyKey,"en-route",current)}
 async arrive(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.progress(publicId,versionNo,idempotencyKey,"arrive",current)}
 async startAction(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.progress(publicId,versionNo,idempotencyKey,"start-action",current)}
 async getActionReport(publicId:string):Promise<DispatchActionReport|null>{void publicId;return null}
 async saveActionReport(publicId:string,detail:string,versionNo:number,key:string,current:DispatchDetail):Promise<DispatchActionResult>{
  try{await apiRequest<unknown>(`/dispatches/${encodeURIComponent(publicId)}/action-report`,{method:"PUT",idempotencyKey:key,body:{detail,expected_version_no:versionNo}});const latest=await this.detail(publicId);return{ok:true,report:{detail,files:[],savedAt:new Date().toISOString(),completedAt:null},detail:latest??current}}
  catch(error){return this.actionFailure(publicId,error)}
 }
 async uploadActionFile(file:File,purpose:DispatchActionFilePurpose,clientFileId:string,key:string){const body=new FormData();body.append("file",file);body.append("purpose_code",purpose);body.append("client_file_id",clientFileId);const response=await apiRequest<{file_public_id:string}>("/files",{method:"POST",idempotencyKey:key,body});return{filePublicId:response.file_public_id}}
 async linkActionFile(publicId:string,filePublicId:string,purpose:DispatchActionFilePurpose,displayOrder:number,key:string):Promise<DispatchActionFile>{await apiRequest<unknown>(`/dispatches/${encodeURIComponent(publicId)}/action-files`,{method:"POST",idempotencyKey:key,body:{file_public_id:filePublicId,purpose_code:purpose,display_order:displayOrder}});return{filePublicId,purpose,displayOrder,fileName:filePublicId}}
 async completeAction(publicId:string,versionNo:number,key:string,current:DispatchDetail):Promise<DispatchActionResult>{try{await apiRequest<unknown>(`/dispatches/${encodeURIComponent(publicId)}/complete`,{method:"POST",idempotencyKey:key,body:{expected_version_no:versionNo}});const latest=await this.detail(publicId);const detail=latest??{...current,status:"ACTION_COMPLETED",versionNo:versionNo+1,actionCompletedAt:new Date().toISOString()};return{ok:true,report:{detail:"",files:[],savedAt:new Date().toISOString(),completedAt:detail.actionCompletedAt},detail}}catch(error){return this.actionFailure(publicId,error)}}
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
