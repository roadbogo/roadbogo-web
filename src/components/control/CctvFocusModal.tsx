import { useEffect, useRef } from "react";
import Link from "next/link";
import type { DashboardCctv, DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
import { incidentStatusLabel } from "@/features/control-dashboard/dashboardDomain";
import { directionLabel, operationalStatusLabel } from "@/features/control-dashboard/dashboardMapper";

interface Props {
  open:boolean; cctv:DashboardCctv|null; relatedIncidents:DashboardIncident[];
  returnFocus:HTMLElement|null; onClose:()=>void; onOpenIncident:(publicId:string)=>void;
}
export function CctvFocusModal({open,cctv,relatedIncidents,returnFocus,onClose,onOpenIncident}:Props){
  const closeRef=useRef<HTMLButtonElement>(null);
  const dialogRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(!open)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";closeRef.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){onClose();return}if(event.key!=="Tab")return;const focusable=dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');if(!focusable?.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};document.addEventListener("keydown",key);return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener("keydown",key);returnFocus?.focus()}},[onClose,open,returnFocus]);
  if(!open||!cctv)return null;
  const evidence=relatedIncidents[0]??null;
  return <div className="command-modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <section ref={dialogRef} className="command-modal" role="dialog" aria-modal="true" aria-labelledby="cctv-focus-title">
      <header><div><span>{cctv.source_type} · {cctv.stream_type} · {operationalStatusLabel[cctv.operational_status]}</span><h2 id="cctv-focus-title">{cctv.cctv_name} 집중 보기</h2><p>{cctv.road.road_name} · {cctv.road_section.section_name} · {directionLabel[cctv.direction_code]}</p></div><button ref={closeRef} type="button" onClick={onClose} aria-label="집중 보기 닫기">×</button></header>
      <div className="command-modal__video"><span>원본 영상과 AI 탐지 결과를 구분하여 표시합니다</span>{evidence&&<i><b>{evidence.class_name}</b><small>{Math.round(evidence.representative_confidence*100)}%</small></i>}</div>
      {evidence&&<dl className="command-modal__evidence"><div><dt>탐지 클래스</dt><dd>{evidence.class_name} ({evidence.class_code})</dd></div><div><dt>신뢰도</dt><dd>{Math.round(evidence.representative_confidence*100)}%</dd></div><div><dt>지속시간</dt><dd>{(evidence.duration_ms/1000).toFixed(1)}초</dd></div><div><dt>반복 탐지</dt><dd>{evidence.detection_count}회</dd></div></dl>}
      <div className="command-modal__incidents"><strong>연결된 진행 사건</strong>{relatedIncidents.length?relatedIncidents.map(item=><Link key={item.public_id} href={`/control/incidents/${item.public_id}`} onClick={()=>onOpenIncident(item.public_id)}><span>{item.incident_no}</span><small>{item.class_name} · {incidentStatusLabel[item.status]}</small></Link>):<p>연결된 진행 사건이 없습니다.</p>}</div>
    </section>
  </div>
}
