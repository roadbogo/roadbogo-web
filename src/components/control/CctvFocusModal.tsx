import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DetectionOverlay, type NormalizedBBox } from "@/components/landing/DetectionOverlay";
import { SelectedIncidentPanel } from "@/components/control/SelectedIncidentPanel";
import type { DashboardCctv, DashboardDispatch, DashboardIncident, DispatchLookupStatus } from "@/features/control-dashboard/dashboardTypes";
import { incidentStatusLabel, riskLabel, selectIncidentForCctv } from "@/features/control-dashboard/dashboardDomain";
import { directionLabel, objectCategoryLabel, operationalStatusLabel } from "@/features/control-dashboard/dashboardMapper";
import { getDetectionVisualVariant } from "@/features/detection/detectionVisualVariant";

interface Props {
 open:boolean;cctv:DashboardCctv|null;relatedIncidents:DashboardIncident[];selectedIncident:DashboardIncident|null;dispatchLookupStatus?:DispatchLookupStatus;
 selectedDispatch:DashboardDispatch|null;canAct:boolean;blockedReason?:string|null;returnFocus:HTMLElement|null;cctvs?:DashboardCctv[];incidents?:DashboardIncident[];onClose:()=>void;onSelectIncident:(publicId:string)=>void;onSelectCctv?:(publicId:string)=>void;
}
const focusDetectionBoxes:Record<string,NormalizedBBox>={
 PEDESTRIAN:{x:.68,y:.39,width:.05,height:.13},
 STOPPED_VEHICLE:{x:.49,y:.4,width:.1,height:.12},
 WRONG_WAY:{x:.69,y:.37,width:.07,height:.13},
 VEHICLE:{x:.49,y:.4,width:.1,height:.12},
 DEBRIS:{x:.52,y:.55,width:.08,height:.1},
 OTHER:{x:.52,y:.48,width:.08,height:.12},
};
export function getFocusDetectionBox(objectCategory:string,classCode?:string|null):NormalizedBBox{return focusDetectionBoxes[classCode??""]??focusDetectionBoxes[objectCategory]??focusDetectionBoxes.OTHER}
export function getFocusCctvOptions(cctvs:DashboardCctv[],selectedPublicId:string,max=5){return cctvs.filter(item=>item.public_id!==selectedPublicId).slice(0,max)}
export function getFocusMediaKey(cctvPublicId:string,incidentPublicId:string|null|undefined,mediaUrl:string){return`${cctvPublicId}:${incidentPublicId??"no-incident"}:${mediaUrl}`}
export function projectBboxIntoContainedImage(bbox:NormalizedBBox,imageAspectRatio:number,containerAspectRatio=16/9):NormalizedBBox{
 if(imageAspectRatio>containerAspectRatio){
  const scale=containerAspectRatio/imageAspectRatio;
  return{x:bbox.x,y:(1-scale)/2+bbox.y*scale,width:bbox.width,height:bbox.height*scale};
 }
 const scale=imageAspectRatio/containerAspectRatio;
 return{x:(1-scale)/2+bbox.x*scale,y:bbox.y,width:bbox.width*scale,height:bbox.height};
}
export function CctvFocusModal({open,cctv,relatedIncidents,selectedIncident,selectedDispatch,dispatchLookupStatus="ready",canAct,blockedReason,returnFocus,cctvs=[],incidents=[],onClose,onSelectIncident,onSelectCctv}:Props){
 const closeRef=useRef<HTMLButtonElement>(null),dialogRef=useRef<HTMLElement>(null);
 const[mediaFailed,setMediaFailed]=useState(false);
 const[mediaAspectRatio,setMediaAspectRatio]=useState<number|null>(null);
 const evidence=cctv?(selectedIncident?.cctv_public_id===cctv.public_id?selectedIncident:relatedIncidents[0]??null):null;
 const mediaUrl=evidence?.representative_image_url??null;
 useEffect(()=>{if(!open)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";closeRef.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();onClose();return}if(event.key!=="Tab")return;const focusable=dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');if(!focusable?.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};document.addEventListener("keydown",key);return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener("keydown",key);returnFocus?.focus()}},[onClose,open,returnFocus]);
 useEffect(()=>{setMediaFailed(false);setMediaAspectRatio(null)},[cctv?.public_id,mediaUrl]);
 if(!open||!cctv)return null;
 const detectionBox=evidence?.detection_bbox??(evidence&&mediaUrl?.startsWith("/images/incidents/")?getFocusDetectionBox(evidence.object_category,evidence.class_code):null);
 const displayedDetectionBox=detectionBox&&mediaAspectRatio?projectBboxIntoContainedImage(detectionBox,mediaAspectRatio):null;
 const mediaState=mediaFailed?"error":mediaUrl?"ready":cctv.video_state==="LOADING"?"loading":"empty";
 const quickCctvs=getFocusCctvOptions(cctvs,cctv.public_id);
 const sourceLabel=cctv.source_type==="MANUAL"?"수동 등록":cctv.source_type==="DEMO"?"시연 데이터":"ITS 연계";
 const videoStatus=cctv.fallback_used?"마지막 정상 탐지 이미지":cctv.video_state==="LOADING"?"실시간 연결 중":cctv.video_state==="UNAVAILABLE"?"영상 제공 없음":cctv.stream_type==="DEMO"||cctv.video_state==="DEMO"?"시연 영상":"실시간";
 return <div className="command-modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><section ref={dialogRef} className="command-modal command-focus-modal" role="dialog" aria-modal="true" aria-labelledby="cctv-focus-title" aria-describedby="cctv-focus-location">
  <header className="command-focus-modal__header"><div><div className="command-focus-modal__title-row"><h2 id="cctv-focus-title">{cctv.cctv_name} 집중 관제</h2><div className="command-focus-modal__badges"><span>{operationalStatusLabel[cctv.operational_status]}</span><span>{videoStatus}</span>{evidence&&<span>{evidence.class_name??objectCategoryLabel[evidence.object_category]} 탐지</span>}</div></div><p id="cctv-focus-location">{cctv.road.road_name} · {cctv.road_section.section_name} · {directionLabel[cctv.direction_code]} · {sourceLabel}</p></div><button ref={closeRef} type="button" onClick={onClose} aria-label="집중 관제 종료">×</button></header>
  <div className="command-focus-modal__body"><div className="command-focus-modal__media"><div className="command-focus-modal__media-header"><strong>{evidence?"AI 탐지 결과":videoStatus}</strong><span>{mediaState==="ready"?"대표 탐지 이미지":mediaState==="loading"?"연결 중":mediaState==="error"?"불러오기 실패":"이미지 없음"}</span></div><div className={`command-modal__video is-${cctv.video_state.toLowerCase()} media-${mediaState}`}>{mediaState==="ready"&&mediaUrl&&<Image key={getFocusMediaKey(cctv.public_id,evidence?.public_id,mediaUrl)} src={mediaUrl} alt={`${cctv.cctv_name} ${evidence?.class_name??"AI 탐지"} 대표 이미지`} fill sizes="(max-width: 1023px) 100vw, 70vw" unoptimized onLoad={event=>{const image=event.currentTarget;if(image.naturalWidth>0&&image.naturalHeight>0)setMediaAspectRatio(image.naturalWidth/image.naturalHeight)}} onError={()=>setMediaFailed(true)}/>} {mediaState==="loading"&&<span className="command-focus-modal__media-state"><strong>영상 연결 중</strong><small>대표 탐지 이미지를 준비하고 있습니다.</small></span>}{mediaState==="empty"&&<span className="command-focus-modal__media-state"><strong>탐지 이미지 없음</strong><small>CCTV 상태와 사건 정보는 계속 확인할 수 있습니다.</small></span>}{mediaState==="error"&&<span className="command-focus-modal__media-state" role="status"><strong>탐지 이미지를 불러오지 못했습니다</strong><small>잠시 후 다시 집중 관제를 열어 주세요.</small></span>}{mediaState==="ready"&&evidence&&displayedDetectionBox&&<div className="command-focus-modal__overlay"><DetectionOverlay variant="tracking" visualVariant={getDetectionVisualVariant({objectCategory:evidence.object_category,classCode:evidence.class_code})} objectType={evidence.object_category} label={evidence.class_name??objectCategoryLabel[evidence.object_category]} confidence={evidence.representative_confidence===null?null:Math.round(evidence.representative_confidence*100)} bbox={displayedDetectionBox} animated={false} className="command-focus-detection"/></div>}</div></div>
   <aside className="command-focus-modal__info" aria-label="집중 관제 판단 정보"><div className="command-focus-modal__inspector-scroll" tabIndex={0}><section className="command-current-detection"><h3>현재 탐지</h3>{evidence?<><strong>{evidence.class_name??objectCategoryLabel[evidence.object_category]}</strong><span>{riskLabel[evidence.current_risk_grade]} 단계 위험 후보</span><dl><div><dt>대표 신뢰도</dt><dd>{evidence.representative_confidence===null?"정보 없음":`${Math.round(evidence.representative_confidence*100)}%`}</dd></div><div><dt>지속시간</dt><dd>{(evidence.duration_ms/1000).toFixed(1)}초</dd></div><div><dt>반복 탐지</dt><dd>{evidence.detection_count}회</dd></div><div><dt>위험 점수</dt><dd>{evidence.current_risk_score}</dd></div></dl></>:<p className="command-focus-modal__empty"><strong>현재 탐지 없음</strong><span>선택한 CCTV에 활성 탐지 정보가 없습니다.</span></p>}</section>
    <section className="command-linked-incidents"><header><h3>연결 사건</h3><span>{relatedIncidents.length}건</span></header><div className="command-linked-incidents__scroll">{relatedIncidents.length?<div className="command-linked-incidents__list" role="listbox" aria-label="연결 사건 선택">{relatedIncidents.map(item=><button key={item.public_id} type="button" role="option" aria-selected={item.public_id===evidence?.public_id} onClick={()=>onSelectIncident(item.public_id)}><span aria-hidden="true">{item.public_id===evidence?.public_id?"✓":""}</span><strong>{item.incident_no}</strong><em>{incidentStatusLabel[item.status]}</em></button>)}</div>:<div className="command-focus-modal__empty"><strong>연결 사건 없음</strong><span>현재 CCTV 상태만 확인할 수 있습니다.</span></div>}
     <SelectedIncidentPanel incident={evidence} cctv={cctv} dispatch={evidence?.public_id===selectedIncident?.public_id?selectedDispatch:null} dispatchLookupStatus={evidence?.public_id===selectedIncident?.public_id?dispatchLookupStatus:"idle"} canAct={evidence?.public_id===selectedIncident?.public_id&&canAct} blockedReason={evidence?.public_id===selectedIncident?.public_id?blockedReason:"선택한 사건의 최신 업무 상태를 확인해 주세요."} showIncidentMetadata className="selected-incident-panel--focus"/>
    </div></section></div>
   </aside>
  </div>
  {quickCctvs.length>0&&<nav className="command-focus-modal__quick" aria-label="다른 CCTV 빠른 전환"><header><strong>다른 CCTV</strong><span>{quickCctvs.length}개 빠른 전환</span></header><div>{quickCctvs.map(item=>{const linked=selectIncidentForCctv(incidents,item.public_id);const thumbnail=linked?.representative_image_url??null;return <button key={item.public_id} type="button" onClick={()=>onSelectCctv?.(item.public_id)} aria-label={`${item.cctv_name} 집중 관제로 전환`}><span className={`command-focus-modal__thumb media-${thumbnail?"ready":item.video_state.toLowerCase()}`}>{thumbnail&&<Image src={thumbnail} alt="" fill sizes="180px" unoptimized/>}<i className={`device-${item.operational_status.toLowerCase()}`}/></span><span><strong>{item.cctv_name}</strong><small>{operationalStatusLabel[item.operational_status]}{linked?` · ${linked.class_name??objectCategoryLabel[linked.object_category]}`:" · 탐지 없음"}</small></span>{linked&&<b className={`risk-${linked.current_risk_grade.toLowerCase()}`}>{riskLabel[linked.current_risk_grade]}</b>}</button>})}</div></nav>}
 </section></div>;
}
