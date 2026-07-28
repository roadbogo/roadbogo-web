"use client";
import { useEffect, useRef, useState } from "react";
import { formatKst, riskLabel } from "@/features/control-dashboard/dashboardDomain";
import type { DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
import type { IncidentDecisionPayload, IncidentDetailRecord, IncidentEvidence } from "./incidentDetailTypes";

export type FinalDecisionType=Exclude<IncidentDecisionPayload["decision_type"],"NEEDS_REVIEW">;
type DecisionInput={reason:string;detail:string};

export const finalDecisionOptions:Record<FinalDecisionType,{label:string;description:string;nextStatus:string;button:string;detailPlaceholder:string;confirmTitle:string;confirmBody:string}>={
  REAL_RISK:{
    label:"현장 출동 필요",description:"도로 위험이 확인되어 현장 출동을 요청합니다.",nextStatus:"출동 요청",
    button:"현장 출동 필요로 판정",detailPlaceholder:"위험이 확인된 위치와 현장 출동이 필요한 이유를 입력하세요.",
    confirmTitle:"현장 출동 필요로 판정할까요?",confirmBody:"사건이 출동 요청 단계로 이동합니다.",
  },
  NO_DISPATCH:{
    label:"출동 없이 종료",description:"위험 요소는 확인됐으나 현장 출동 없이 사건을 종료합니다.",nextStatus:"사건 종료",
    button:"출동 없이 종료",detailPlaceholder:"현장 출동 없이 사건을 종료할 수 있다고 판단한 근거를 입력하세요.",
    confirmTitle:"출동 없이 사건을 종료할까요?",confirmBody:"현장 출동 요청 없이 사건이 종료되며 일반 판정 API로 되돌릴 수 없습니다.",
  },
  FALSE_POSITIVE:{
    label:"오탐",description:"실제 위험이 아닌 AI 오인식으로 판단합니다.",nextStatus:"오탐 종료",
    button:"오탐으로 판정",detailPlaceholder:"실제 위험이 아닌 AI 오인식으로 판단한 근거를 입력하세요.",
    confirmTitle:"오탐으로 판정할까요?",confirmBody:"사건이 오탐으로 종료되며 일반 판정 API로 되돌릴 수 없습니다.",
  },
};
const optionOrder:FinalDecisionType[]=["REAL_RISK","NO_DISPATCH","FALSE_POSITIVE"];

export function composeDecisionReason(input:DecisionInput){
  return`[판정 사유]\n${input.reason.trim()}\n\n[상세 근거]\n${input.detail.trim()}`;
}

export function FinalDecisionPanel({incident,evidence,busy,onCancel,onConfirm}:{incident:DashboardIncident;evidence?:IncidentEvidence;busy:boolean;onCancel:()=>void;onConfirm:(payload:IncidentDecisionPayload)=>void}){
  const [selected,setSelected]=useState<FinalDecisionType|null>(null);
  const [inputs,setInputs]=useState<Record<FinalDecisionType,DecisionInput>>({
    REAL_RISK:{reason:"",detail:""},NO_DISPATCH:{reason:"",detail:""},FALSE_POSITIVE:{reason:"",detail:""},
  });
  const [confirming,setConfirming]=useState(false);
  const confirmRef=useRef<HTMLElement>(null);
  const input=selected?inputs[selected]:null;
  const composed=input?composeDecisionReason(input):"";
  const complete=Boolean(input?.reason.trim()&&input.detail.trim()&&composed.length<=1000);
  const summary=[
    incident.representative_confidence===null?null:`신뢰도 ${Math.round(incident.representative_confidence*100)}%`,
    evidence?`위험 점수 ${evidence.risk.risk_score}`:`위험 점수 ${incident.current_risk_score}`,
    riskLabel[incident.current_risk_grade],
    evidence?`반복 탐지 ${evidence.risk.repeat_count}회`:incident.detection_count?`반복 탐지 ${incident.detection_count}회`:null,
  ].filter(Boolean);
  useEffect(()=>{
    if(!confirming)return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&!busy){event.preventDefault();setConfirming(false);return}
      if(event.key!=="Tab"||!confirmRef.current)return;
      const controls=[...confirmRef.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
      const first=controls[0],last=controls.at(-1);
      if(!first||!last)return;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[busy,confirming]);
  const update=(field:keyof DecisionInput,value:string)=>{
    if(!selected)return;
    setInputs(current=>({...current,[selected]:{...current[selected],[field]:value}}));
  };
  const option=selected?finalDecisionOptions[selected]:null;
  return <section className="final-decision" aria-busy={busy}>
    <header className="final-decision__header"><div><span>현재 단계</span><b>검토 중</b></div><h2>최종 판정</h2><p>AI 분석 근거를 확인한 후 사건의 처리 방향을 결정하세요.</p></header>
    <aside className="final-decision__ai" aria-label="AI 판단 보조 정보"><strong>{summary.join(" · ")}</strong><span>AI 분석은 판단 보조 정보이며 최종 결정은 관제자가 수행합니다.</span></aside>
    <fieldset className="final-decision__options"><legend>최종 판정 결과</legend>{optionOrder.map(value=>{const item=finalDecisionOptions[value],active=selected===value;return <div key={value} className="final-decision__option" data-decision={value} data-selected={active||undefined}>
      <label><input type="radio" name="final-decision" checked={active} disabled={busy} onChange={()=>setSelected(value)}/><span><strong>{item.label}</strong><small>{item.description}</small><em>판정 후 상태 <b>{item.nextStatus}</b></em></span></label>
      {active&&<div className="final-decision__fields">
        <label htmlFor={`decision-reason-${value}`}>판정 사유 *<input id={`decision-reason-${value}`} value={inputs[value].reason} maxLength={300} disabled={busy} placeholder="판정의 핵심 사유를 간결하게 입력하세요." aria-describedby="decision-validation" onChange={event=>update("reason",event.target.value)}/></label>
        <label htmlFor={`decision-detail-${value}`}>상세 근거 *<textarea id={`decision-detail-${value}`} value={inputs[value].detail} disabled={busy} placeholder={item.detailPlaceholder} aria-describedby="decision-validation decision-count" onChange={event=>update("detail",event.target.value)}/></label>
        <div className="final-decision__transition"><span>상태 변경</span><strong><span className="sr-only">현재 상태 </span>검토 중 <i aria-hidden="true">→</i> <span className="sr-only">변경 상태 </span>{item.nextStatus}</strong></div>
      </div>}
    </div>})}</fieldset>
    <p className="final-decision__hold">판정을 완료하지 않으면 사건은 검토 중 상태로 유지됩니다.</p>
    <div className="final-decision__validation"><p id="decision-validation" role="status">{!selected?"판정 결과를 선택해 주세요.":!input?.reason.trim()?"판정 사유를 입력해 주세요.":!input.detail.trim()?"상세 근거를 입력해 주세요.":composed.length>1000?"판정 사유와 상세 근거를 합쳐 1,000자 이내로 입력해 주세요.":"선택한 결과와 근거를 확인한 뒤 최종 판정을 진행하세요."}</p>{selected&&<span id="decision-count">{composed.length} / 1000</span>}</div>
    <footer><button type="button" disabled={busy} onClick={onCancel}>취소</button><button type="button" disabled={busy||!complete} onClick={()=>setConfirming(true)}>{busy?"판정 처리 중":option?.button??"판정 결과를 선택해 주세요"}</button></footer>
    {confirming&&selected&&option&&input&&<div className="decision-confirm-backdrop"><section ref={confirmRef} className="decision-confirm" role="dialog" aria-modal="true" aria-labelledby="decision-confirm-title"><h3 id="decision-confirm-title">{option.confirmTitle}</h3><p>{option.confirmBody}<br/>판정 결과와 사유는 처리 이력에 기록됩니다.</p><dl><div><dt>판정 사유</dt><dd>{input.reason.trim()}</dd></div><div><dt>상세 근거</dt><dd>{input.detail.trim()}</dd></div></dl><div><button type="button" autoFocus disabled={busy} onClick={()=>setConfirming(false)}>취소</button><button type="button" disabled={busy} onClick={()=>onConfirm({decision_type:selected,decision_reason:composed})}>{busy?"판정 처리 중":selected==="REAL_RISK"?"판정하고 계속":option.button}</button></div></section></div>}
  </section>;
}

export function FinalDecisionSummary({record}:{record:IncidentDetailRecord}){
  const decision=record.decision;
  if(!decision)return null;
  const type=(decision.result==="실제 위험"?"REAL_RISK":decision.result==="오탐"?"FALSE_POSITIVE":decision.result) as FinalDecisionType;
  const option=finalDecisionOptions[type];
  return <section className="final-decision-summary"><span>최종 판정 완료</span><h2>{option?.label??decision.result}</h2><p>{decision.reason}</p><dl><div><dt>판정자</dt><dd>{decision.decided_by}</dd></div><div><dt>판정 시각</dt><dd>{formatKst(decision.decided_at)} KST</dd></div><div><dt>변경된 상태</dt><dd>{option?.nextStatus??record.incident.status}</dd></div></dl></section>;
}
