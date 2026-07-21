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
 async accept(publicId:string,versionNo:number,idempotencyKey:string){return this.command(publicId,versionNo,idempotencyKey,"accept")}
 async reject(publicId:string,versionNo:number,reason:string,idempotencyKey:string){return this.command(publicId,versionNo,idempotencyKey,"reject",reason)}
 private async command(publicId:string,versionNo:number,key:string,action:"accept"|"reject",reason?:string):Promise<DispatchCommandResult>{if(!uuid.test(publicId))throw new Error("INVALID_DISPATCH_PUBLIC_ID");if(!Number.isInteger(versionNo)||versionNo<0)throw new Error("INVALID_DISPATCH_VERSION");const send=()=>apiRequest<DispatchAcceptDataDto|DispatchRejectDataDto>(`/dispatches/${encodeURIComponent(publicId)}/${action}`,{method:"POST",idempotencyKey:key,body:action==="accept"?{expected_version_no:versionNo}:{expected_version_no:versionNo,rejection_reason:reason}});try{let response;try{response=await send()}catch(error){if(!(error instanceof TypeError))throw error;response=await send()}const latest=await this.detail(publicId);if(latest)return{ok:true,detail:{...latest,status:response.dispatch.status,versionNo:response.dispatch.version_no,incident:{...latest.incident,status:response.incident.status},incidentVersionNo:response.incident.version_no,...("rejection_reason" in response.dispatch?{rejectionReason:response.dispatch.rejection_reason}:{acceptedAt:response.dispatch.accepted_at})}};throw new Error("DISPATCH_REFRESH_FAILED")}catch(error){if(error instanceof ApiError){const latest=refreshCodes.has(error.code)?await this.detail(publicId):null;return{ok:false,code:error.code||String(error.httpStatus),latest}}throw error}}
}
