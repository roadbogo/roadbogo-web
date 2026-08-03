import type {CctvNetworkSnapshot,NetworkCctv} from "./cctvNetworkTypes";

export type CctvDisplayStatus="normal"|"attention"|"fault"|"inactive"|"unknown";
export type CctvReviewReasonCode="OPERATION_FAULT"|"LOCATION_MISSING"|"STREAM_MISSING"|"DIRECTION_UNKNOWN"|"SYNC_MISSING"|"ALTERNATE_SOURCE"|"INACTIVE";
export type CctvReviewReason={code:CctvReviewReasonCode;label:string;description:string;severity:"critical"|"warning"|"info";priority:number};

const reasons:Record<CctvReviewReasonCode,CctvReviewReason>={
 OPERATION_FAULT:{code:"OPERATION_FAULT",label:"운영 상태 이상",description:"CCTV 운영 상태에서 이상이 확인되었습니다.",severity:"critical",priority:1},
 LOCATION_MISSING:{code:"LOCATION_MISSING",label:"필수 위치 정보 누락",description:"노선·구간 또는 설치 좌표를 확인해 주세요.",severity:"critical",priority:2},
 STREAM_MISSING:{code:"STREAM_MISSING",label:"활성 스트림 없음",description:"사용 가능한 활성 영상 스트림이 없습니다.",severity:"warning",priority:3},
 DIRECTION_UNKNOWN:{code:"DIRECTION_UNKNOWN",label:"방향 정보 미확인",description:"방향 정보가 등록되지 않았습니다.",severity:"warning",priority:4},
 SYNC_MISSING:{code:"SYNC_MISSING",label:"동기화 기록 없음",description:"최근 정상 동기화 기록이 없습니다.",severity:"warning",priority:5},
 ALTERNATE_SOURCE:{code:"ALTERNATE_SOURCE",label:"대체·시연 데이터",description:"ITS가 아닌 대체 기준정보를 사용합니다.",severity:"info",priority:6},
 INACTIVE:{code:"INACTIVE",label:"비활성 CCTV",description:"현재 비활성 상태인 CCTV입니다.",severity:"info",priority:7},
};

export const REVIEW_REASON_ORDER=(Object.values(reasons) as CctvReviewReason[]).sort((a,b)=>a.priority-b.priority);
export const statusLabel:Record<CctvDisplayStatus,string>={normal:"정상",attention:"확인 필요",fault:"운영 이상",inactive:"비활성",unknown:"상태 미확인"};

export function getCctvReviewReasons(cctv:NetworkCctv,snapshot?:Pick<CctvNetworkSnapshot,"roads"|"sections">|null):CctvReviewReason[]{
 const result:CctvReviewReason[]=[];
 if(cctv.operationalStatus==="FAULT")result.push(reasons.OPERATION_FAULT);
 const road=snapshot?.roads.find(item=>item.publicId===cctv.roadPublicId);
 const section=snapshot?.sections.find(item=>item.publicId===cctv.roadSectionPublicId);
 if((snapshot&&(!road||!section))||!Number.isFinite(cctv.latitude)||!Number.isFinite(cctv.longitude))result.push(reasons.LOCATION_MISSING);
 if(!cctv.hasStream||!cctv.streamType)result.push(reasons.STREAM_MISSING);
 if(cctv.directionCode==="UNKNOWN")result.push(reasons.DIRECTION_UNKNOWN);
 if(!cctv.lastSuccessfulSyncAt)result.push(reasons.SYNC_MISSING);
 if(cctv.sourceType!=="ITS")result.push(reasons.ALTERNATE_SOURCE);
 if(!cctv.isActive||cctv.operationalStatus==="INACTIVE")result.push(reasons.INACTIVE);
 return result.sort((a,b)=>a.priority-b.priority);
}

export function displayStatus(cctv:NetworkCctv,snapshot?:Pick<CctvNetworkSnapshot,"roads"|"sections">|null):CctvDisplayStatus{
 if(!cctv.isActive||cctv.operationalStatus==="INACTIVE")return"inactive";
 if(cctv.operationalStatus==="FAULT")return"fault";
 if(getCctvReviewReasons(cctv,snapshot).length||cctv.operationalStatus==="DELAYED")return"attention";
 if(cctv.operationalStatus==="NORMAL")return"normal";
 return"unknown";
}
export function needsReview(cctv:NetworkCctv,snapshot?:Pick<CctvNetworkSnapshot,"roads"|"sections">|null){return getCctvReviewReasons(cctv,snapshot).length>0}
export function primaryReviewReason(cctv:NetworkCctv,snapshot?:Pick<CctvNetworkSnapshot,"roads"|"sections">|null){return getCctvReviewReasons(cctv,snapshot)[0]??null}
export function reviewPriority(cctv:NetworkCctv,snapshot?:Pick<CctvNetworkSnapshot,"roads"|"sections">|null){return primaryReviewReason(cctv,snapshot)?.priority??99}
export function compareByReviewPriority(a:NetworkCctv,b:NetworkCctv,snapshot?:Pick<CctvNetworkSnapshot,"roads"|"sections">|null){
 const priority=reviewPriority(a,snapshot)-reviewPriority(b,snapshot);if(priority)return priority;
 if(!a.lastSuccessfulSyncAt&&b.lastSuccessfulSyncAt)return-1;if(a.lastSuccessfulSyncAt&&!b.lastSuccessfulSyncAt)return 1;
 const sync=(a.lastSuccessfulSyncAt??"").localeCompare(b.lastSuccessfulSyncAt??"");if(sync)return sync;
 return a.name.localeCompare(b.name,"ko")||a.code.localeCompare(b.code);
}
export function mapPosition(cctv:NetworkCctv,items:NetworkCctv[]){const lats=items.map(item=>item.latitude),lngs=items.map(item=>item.longitude),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);return{x:8+(cctv.longitude-minLng)/Math.max(.001,maxLng-minLng)*84,y:8+(maxLat-cctv.latitude)/Math.max(.001,maxLat-minLat)*84}}
export function getCctvPaginationItems(current:number,total:number):(number|"ellipsis")[]{if(total<=7)return Array.from({length:total},(_,index)=>index+1);const values:(number|"ellipsis")[]=[1];if(current>4)values.push("ellipsis");for(let value=Math.max(2,current-1);value<=Math.min(total-1,current+1);value++)values.push(value);if(current<total-3)values.push("ellipsis");values.push(total);return values}
