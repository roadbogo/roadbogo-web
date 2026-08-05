import type {IncidentActionResult,IncidentDetailRecord} from "./incidentDetailTypes";

export const closureRefreshWarning="사건 종료는 완료됐지만 최신 상세 정보를 다시 불러오지 못했습니다.";
export const closureConflictRefreshWarning="사건 상태가 변경되었을 수 있지만 최신 상세 정보를 다시 불러오지 못했습니다.";

export function applyClosureCommandResult(record:IncidentDetailRecord,result:Extract<IncidentActionResult,{ok:true}>):IncidentDetailRecord{
  return{...record,closed_at:result.closed_at??record.closed_at??null,incident:{...record.incident,status:result.status,version_no:result.version_no,...(result.closed_at?{updated_at:result.closed_at}:{})}};
}

export async function refreshIncidentAfterClosure(get:()=>Promise<IncidentDetailRecord|null>,record?:IncidentDetailRecord){
  if(record)return{record,warning:""};
  try{
    const latest=await get();
    return latest?{record:latest,warning:""}:{record:null,warning:closureRefreshWarning};
  }catch{
    return{record:null,warning:closureRefreshWarning};
  }
}
