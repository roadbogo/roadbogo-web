import type { IncidentMemoType } from "./incidentDetailTypes";

export type MemoDraftValues=Record<IncidentMemoType,string[]>;
export interface IncidentMemoDraft{type:IncidentMemoType;values:MemoDraftValues}
export const memoTypeLabel:Record<IncidentMemoType,string>={GENERAL:"일반",REVIEW:"검토 기록",DISPATCH:"출동 전달",CLOSURE:"종료 참고"};

export const memoComposerFields:Record<IncidentMemoType,Array<{label:string;placeholder:string}>>={
  GENERAL:[{label:"메모 내용",placeholder:"판단 근거, 특이사항, 전달 내용 등을 자유롭게 입력하세요"}],
  REVIEW:[
    {label:"확인한 내용",placeholder:"원본 영상과 탐지 결과에서 확인한 상황을 입력하세요"},
    {label:"판단 근거",placeholder:"위험 또는 오탐 가능성을 판단한 근거를 입력하세요"},
    {label:"추가 확인 사항",placeholder:"추가 CCTV 확인이나 후속 검토가 필요한 내용을 입력하세요"},
  ],
  DISPATCH:[
    {label:"현장 상황",placeholder:"출동 담당자가 알아야 할 현재 상황을 입력하세요"},
    {label:"주의 사항",placeholder:"현장 접근과 조치 과정의 주의 사항을 입력하세요"},
    {label:"요청 내용",placeholder:"현장에서 확인하거나 수행해야 할 내용을 입력하세요"},
  ],
  CLOSURE:[
    {label:"최종 확인 내용",placeholder:"종료 전 최종 확인한 내용을 입력하세요"},
    {label:"조치 결과",placeholder:"현장 조치 결과와 확인 내용을 입력하세요"},
    {label:"종료 참고 사항",placeholder:"추후 참고하거나 인계할 내용을 입력하세요"},
  ],
};

export const memoQuickPhrases:Record<Exclude<IncidentMemoType,"GENERAL">,Array<{text:string;field:number}>>={
  REVIEW:[
    {text:"원본 영상 확인 완료",field:0},{text:"반복 탐지 확인",field:1},
    {text:"추가 CCTV 확인 필요",field:2},{text:"오탐 가능성 있음",field:1},
  ],
  DISPATCH:[
    {text:"2차 사고 주의",field:1},{text:"차로 진입 주의",field:1},
    {text:"안전 확보 우선",field:2},{text:"조치 전후 사진 등록 필요",field:2},
  ],
  CLOSURE:[
    {text:"현장 조치 완료 확인",field:0},{text:"추가 위험 요소 없음",field:0},
    {text:"조치 결과 확인 완료",field:1},{text:"종료 후 경과 확인 필요",field:2},
  ],
};

export function createEmptyMemoDraft():IncidentMemoDraft{
  return{type:"GENERAL",values:{
    GENERAL:[""],
    REVIEW:["","",""],
    DISPATCH:["","",""],
    CLOSURE:["","",""],
  }};
}

export function composeMemoContent(type:IncidentMemoType,values:MemoDraftValues):string{
  if(type==="GENERAL")return values.GENERAL[0]??"";
  return memoComposerFields[type].flatMap((field,index)=>{
    const value=(values[type][index]??"").trim();
    return value?[`[${field.label}]\n${value}`]:[];
  }).join("\n\n");
}

export function memoDraftStorageKey(incidentPublicId:string){
  return`roadbogo_incident_memo_draft:${incidentPublicId}`;
}

export function parseMemoDraft(value:string|null):IncidentMemoDraft|null{
  if(!value)return null;
  try{
    const parsed=JSON.parse(value) as Partial<IncidentMemoDraft>;
    if(!["GENERAL","REVIEW","DISPATCH","CLOSURE"].includes(parsed.type??""))return null;
    const empty=createEmptyMemoDraft();
    for(const type of Object.keys(empty.values) as IncidentMemoType[]){
      if(!Array.isArray(parsed.values?.[type]))return null;
      empty.values[type]=memoComposerFields[type].map((_,index)=>String(parsed.values?.[type]?.[index]??""));
    }
    empty.type=parsed.type as IncidentMemoType;
    return empty;
  }catch{return null}
}

export function hasMemoDraftContent(draft:IncidentMemoDraft){
  return Object.values(draft.values).some(values=>values.some(value=>value.trim()));
}
