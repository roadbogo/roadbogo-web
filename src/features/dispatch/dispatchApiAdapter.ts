import { ApiError,apiRequest } from "@/lib/apiClient";
import { buildDispatchListQuery } from "./dispatchDomain";
import { mapDispatchDetail,mapDispatchPage } from "./dispatchMapper";
import type { DispatchAcceptDataDto,DispatchAdapter,DispatchCommandResult,DispatchDetail,DispatchDetailDto,DispatchListQuery,DispatchMineDataDto,DispatchRejectDataDto } from "./dispatchTypes";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const refreshCodes=new Set(["DISPATCH_VERSION_CONFLICT","DISPATCH_INVALID_STATE_TRANSITION","DISPATCH_IDEMPOTENCY_CONFLICT","INCIDENT_INVALID_STATE_TRANSITION"]);
export class ApiDispatchAdapter implements DispatchAdapter{
 readonly mode="api" as const;
 list(query:DispatchListQuery={}){return apiRequest<DispatchMineDataDto>(`/dispatches/mine?${buildDispatchListQuery(query)}`).then(mapDispatchPage)}
 async detail(publicId:string):Promise<DispatchDetail|null>{if(!uuid.test(publicId))throw new Error("INVALID_DISPATCH_PUBLIC_ID");try{return mapDispatchDetail(await apiRequest<DispatchDetailDto>(`/dispatches/${encodeURIComponent(publicId)}`))}catch(error){if(error instanceof ApiError&&error.httpStatus===404)return null;throw error}}
 async accept(publicId:string,versionNo:number,idempotencyKey:string,current?:DispatchDetail){return this.command(publicId,versionNo,idempotencyKey,"accept",current)}
 async reject(publicId:string,versionNo:number,reason:string,idempotencyKey:string,current?:DispatchDetail){return this.command(publicId,versionNo,idempotencyKey,"reject",current,reason)}
 private mergeCommand(base:DispatchDetail,response:DispatchAcceptDataDto|DispatchRejectDataDto):DispatchDetail{return{...base,status:response.dispatch.status,versionNo:response.dispatch.version_no,incident:{...base.incident,status:response.incident.status},incidentVersionNo:response.incident.version_no,...("rejection_reason" in response.dispatch?{rejectionReason:response.dispatch.rejection_reason}:{acceptedAt:response.dispatch.accepted_at})}}
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
}
