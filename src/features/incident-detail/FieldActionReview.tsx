"use client";

/* eslint-disable @next/next/no-img-element -- Mock action photos can use local blob URLs. */
import {useEffect,useRef,useState,type Ref} from "react";
import {formatKst} from "@/features/control-dashboard/dashboardDomain";
import type {IncidentDetailRecord} from "./incidentDetailTypes";

type Photo={label:string;url:string};

export function fieldActionClosureBlockReason(record:IncidentDetailRecord,{requireResult=true,requirePhotos=true}:{requireResult?:boolean;requirePhotos?:boolean}={}){
  if(!record.field_action)return requireResult?"현장 조치 결과가 아직 연결되지 않았습니다.":null;
  if(!record.field_action.detail.trim())return "조치 내용이 없어 사건을 종료할 수 없습니다.";
  if(!record.field_action.completed_at)return "조치 등록 시각을 확인할 수 없습니다.";
  if(requirePhotos&&(!record.field_action.before_image_url||!record.field_action.after_image_url))return "조치 전·후 사진 연결이 완료되어야 사건을 종료할 수 있습니다.";
  if(!record.dispatch?.responder_label)return "출동 담당자 정보를 확인할 수 없습니다.";
  return null;
}

export function FieldActionReview({record,onClose,busy=false,closeButtonRef,canClose=true,requireResult=true,requirePhotos=true}:{record:IncidentDetailRecord;onClose?:()=>void;busy?:boolean;closeButtonRef?:Ref<HTMLButtonElement>;canClose?:boolean;requireResult?:boolean;requirePhotos?:boolean}){
  const apiResultUnavailable=record.field_action_supported===false;
  const[preview,setPreview]=useState<Photo|null>(null),triggerRef=useRef<HTMLButtonElement|null>(null);
  const action=record.field_action,closed=record.incident.status==="CLOSED",blockReason=fieldActionClosureBlockReason(record,{requireResult:requireResult&&!apiResultUnavailable,requirePhotos:requirePhotos&&!apiResultUnavailable});
  const permitted=canClose;
  const closePreview=()=>{setPreview(null);requestAnimationFrame(()=>triggerRef.current?.focus())};
  useEffect(()=>{if(!preview)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")closePreview()};document.addEventListener("keydown",escape);return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",escape)}},[preview]);
  const photos:Photo[]=[...(action?.before_image_url?[{label:"조치 전",url:action.before_image_url}]:[]),...(action?.after_image_url?[{label:"조치 후",url:action.after_image_url}]:[])];
  const closeHistory=[...record.histories].reverse().find(item=>item.label.includes("종료"));
  return <section className="field-action-review" aria-labelledby="field-action-title" data-closed={closed||undefined}>
    <header><div><span>{closed?"CLOSED":"CLOSURE REVIEW"}</span><h3 id="field-action-title">{closed?"최종 조치 결과":"현장 조치 완료 검토"}</h3><p>{closed?"관제 확인을 거쳐 최종 종료된 사건입니다.":"출동 담당자가 제출한 결과를 확인한 뒤 사건을 종료하세요."}</p></div><b>{closed?"종료 완료":"관제 확인 대기"}</b></header>
    {action?<><dl><div><dt>출동 담당자</dt><dd>{record.dispatch?.responder_label??"정보 없음"}</dd></div><div><dt>조치 등록 시각</dt><dd>{action.completed_at?`${formatKst(action.completed_at)} KST`:"정보 없음"}</dd></div><div className="field-action-detail"><dt>조치 내용</dt><dd>{action.detail||"정보 없음"}</dd></div>{closed&&<div><dt>사건 종료 시각</dt><dd>{closeHistory?`${formatKst(closeHistory.occurred_at)} KST`:record.closed_at?`${formatKst(record.closed_at)} KST`:"최신 상세 확인 필요"}</dd></div>}</dl><div className="field-action-photos">{photos.map(photo=><article key={photo.label}><strong>{photo.label} 사진</strong><button type="button" onClick={event=>{triggerRef.current=event.currentTarget;setPreview(photo)}} aria-label={`${photo.label} 사진 확대 보기`}><img src={photo.url} alt={`${photo.label} 현장 사진`}/><span>확대 보기</span></button></article>)}</div>{action.photo_preview_expired&&<p className="field-action-empty" role="status">새로고침으로 임시 사진 미리보기가 만료되었습니다. 사진을 다시 등록해 주세요.</p>}{apiResultUnavailable&&photos.length===0&&<p className="field-action-empty">사진 조회 API가 제공되지 않아 등록 사진은 이 화면에서 확인할 수 없습니다.</p>}</>:<p className="field-action-empty">{apiResultUnavailable?"현장 조치 결과 조회 API가 제공되지 않아 상세 내용은 이 화면에서 확인할 수 없습니다.":"현장 조치 결과가 아직 연결되지 않았습니다."}</p>}
    {blockReason&&!closed&&<p className="field-action-block" role="alert"><strong>사건 종료 불가</strong>{blockReason}</p>}
    {!closed&&permitted&&<button ref={closeButtonRef} className="field-action-close" type="button" disabled={Boolean(blockReason)||busy} onClick={onClose}>{busy?"처리 중":"사건 최종 종료"}</button>}
    {!closed&&!permitted&&<p className="field-action-block" role="status"><strong>사건 종료 권한 없음</strong>담당 관제자 또는 관제 관리자만 사건을 종료할 수 있습니다.</p>}
    {preview&&<div className="field-action-preview" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&closePreview()}><section role="dialog" aria-modal="true" aria-label={`${preview.label} 사진 확대 보기`}><header><strong>{preview.label} 사진</strong><button type="button" autoFocus onClick={closePreview}>닫기</button></header><img src={preview.url} alt={`${preview.label} 현장 사진 확대 보기`}/></section></div>}
  </section>
}
