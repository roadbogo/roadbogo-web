"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatKst } from "@/features/control-dashboard/dashboardDomain";
import { normalizeMemoType, sortIncidentMemos } from "./incidentDetailDomain";
import { composeMemoContent, createEmptyMemoDraft, hasMemoDraftContent, memoComposerFields, memoDraftStorageKey, memoQuickPhrases, memoTypeLabel, parseMemoDraft, type IncidentMemoDraft } from "./incidentMemoDraft";
import type { IncidentMemo, IncidentMemoType } from "./incidentDetailTypes";

const types=Object.keys(memoTypeLabel) as IncidentMemoType[];

export function IncidentMemoComposer({incidentPublicId,memos,editingMemo,busy,error,inline=false,initialType="GENERAL",onSubmit,onClose}:{incidentPublicId:string;memos:IncidentMemo[];editingMemo:IncidentMemo|null;busy:boolean;error:string;inline?:boolean;initialType?:IncidentMemoType;onSubmit:(type:IncidentMemoType,content:string)=>void;onClose:()=>void}){
  const dialogRef=useRef<HTMLElement>(null),firstInputRef=useRef<HTMLTextAreaElement>(null);
  const storageKey=memoDraftStorageKey(incidentPublicId);
  const [draft,setDraft]=useState<IncidentMemoDraft>(()=>{
    if(editingMemo){const next=createEmptyMemoDraft();next.type=normalizeMemoType(editingMemo.memo_type);next.values[next.type][0]=editingMemo.content;return next}
    if(typeof window!=="undefined"){
      const stored=parseMemoDraft(sessionStorage.getItem(storageKey));
      if(stored)return stored;
    }
    const next=createEmptyMemoDraft();next.type=initialType;return next;
  });
  const [confirmClose,setConfirmClose]=useState(false);
  const type=draft.type;
  const content=useMemo(()=>editingMemo?draft.values[type][0]??"":composeMemoContent(type,draft.values),[draft,editingMemo,type]);
  const overLimit=content.length>2000;
  const latestMemo=useMemo(()=>sortIncidentMemos(memos.filter(memo=>!memo.deleted_at))[0],[memos]);
  const changed=editingMemo?normalizeMemoType(editingMemo.memo_type)!==type||editingMemo.content!==content.trim():Boolean(content.trim());

  useEffect(()=>{
    const previousOverflow=document.body.style.overflow;
    if(!inline)document.body.style.overflow="hidden";
    window.requestAnimationFrame(()=>firstInputRef.current?.focus());
    return()=>{document.body.style.overflow=previousOverflow};
  },[inline]);
  useEffect(()=>{
    if(editingMemo)return;
    try{
      if(hasMemoDraftContent(draft))sessionStorage.setItem(storageKey,JSON.stringify(draft));
      else sessionStorage.removeItem(storageKey);
    }catch{/* Draft persistence is an optional browser enhancement. */}
  },[draft,editingMemo,storageKey]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&!busy){event.preventDefault();requestClose();return}
      if(event.key==="Enter"&&(event.ctrlKey||event.metaKey)&&changed&&!overLimit&&!busy){event.preventDefault();onSubmit(type,content)}
      if(inline)return;
      if(event.key!=="Tab"||!dialogRef.current)return;
      const controls=[...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),textarea:not([disabled])')];
      const first=controls[0],last=controls.at(-1);
      if(!first||!last)return;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  });

  const requestClose=()=>{
    if(busy)return;
    if(editingMemo){onClose();return}
    if(changed){setConfirmClose(true);return}
    onClose();
  };
  const discard=()=>{
    if(!editingMemo)try{sessionStorage.removeItem(storageKey)}catch{}
    setDraft(createEmptyMemoDraft());
    onClose();
  };
  const updateValue=(index:number,value:string)=>setDraft(current=>({...current,values:{...current.values,[current.type]:current.values[current.type].map((item,itemIndex)=>itemIndex===index?value:item)}}));
  const insertPhrase=(field:number,text:string)=>setDraft(current=>{
    const values=[...current.values[current.type]];
    values[field]=values[field]?.trimEnd()?`${values[field].trimEnd()}\n${text}`:text;
    return{...current,values:{...current.values,[current.type]:values}};
  });

  const contentNode=<section ref={dialogRef} className={`memo-dialog memo-composer${inline?" memo-composer--inline":""}`} role={inline?"region":"dialog"} aria-modal={inline?undefined:true} aria-labelledby="memo-dialog-title" aria-describedby="memo-dialog-description" aria-busy={busy}>
      <header><div><h2 id="memo-dialog-title">{editingMemo?"관제 메모 정정":"관제 메모 작성"}</h2><p id="memo-dialog-description">자유롭게 작성하거나 업무 단계에 맞는 기록 항목을 활용하세요.</p></div><button type="button" aria-label="관제 메모 창 닫기" disabled={busy} onClick={requestClose}>×</button></header>
      <div className="memo-dialog__body">
        <fieldset className="memo-method"><legend>메모 유형</legend><div role="radiogroup" aria-label="관제 메모 유형">{types.map(value=><button key={value} type="button" role="radio" aria-checked={type===value} disabled={busy} onClick={()=>setDraft(current=>{if(!editingMemo)return{...current,type:value};const values={...current.values,[value]:[current.values[current.type][0]??""]};return{type:value,values}})}>{memoTypeLabel[value]}</button>)}</div></fieldset>
        {!editingMemo&&latestMemo&&<aside className="memo-recent" aria-label="최근 관제 메모"><div><strong>최근 기록 · {memoTypeLabel[normalizeMemoType(latestMemo.memo_type)]}</strong><span>{latestMemo.created_by.user_name} · {formatKst(latestMemo.created_at)} KST</span></div><p>{latestMemo.content}</p></aside>}
        <div className="memo-fields">{editingMemo?<label htmlFor="memo-edit-content">메모 내용<textarea id="memo-edit-content" ref={firstInputRef} value={draft.values[type][0]} disabled={busy} placeholder="메모 내용을 입력하세요" aria-invalid={overLimit||Boolean(error)} aria-describedby="memo-content-count memo-content-error" onChange={event=>updateValue(0,event.target.value)}/></label>:memoComposerFields[type].map((field,index)=><label key={field.label} htmlFor={`memo-${type.toLowerCase()}-${index}`}>{field.label}<textarea id={`memo-${type.toLowerCase()}-${index}`} ref={index===0?firstInputRef:undefined} value={draft.values[type][index]} disabled={busy} placeholder={field.placeholder} aria-invalid={overLimit||Boolean(error)} aria-describedby="memo-content-count memo-content-error" onChange={event=>updateValue(index,event.target.value)}/></label>)}</div>
        {!editingMemo&&type!=="GENERAL"&&<section className="memo-quick"><strong>빠른 문구</strong><div>{memoQuickPhrases[type].map(item=><button type="button" key={item.text} disabled={busy} aria-label={`${item.text} 문구 삽입`} onClick={()=>insertPhrase(item.field,item.text)}>+ {item.text}</button>)}</div></section>}
        <div className="memo-dialog__meta"><p id="memo-content-error" role="alert">{overLimit?"합성된 메모가 2,000자를 초과했습니다. 내용을 줄여 주세요.":error}</p><span id="memo-content-count" aria-live="polite" data-state={overLimit?"error":content.length>=1800?"warning":"normal"}>{content.length} / 2000</span></div>
        {!editingMemo&&<p className="memo-draft-status">작성 내용은 이 사건의 임시 메모로 자동 보관됩니다.</p>}
      </div>
      <footer><button type="button" disabled={busy} onClick={requestClose}>취소</button><button type="button" disabled={busy||!changed||overLimit} onClick={()=>onSubmit(type,content)}>{busy?editingMemo?"저장 중":"등록 중":editingMemo?"정정 저장":"메모 등록"}</button></footer>
      {confirmClose&&<div className="memo-close-confirm" role="alertdialog" aria-modal="true" aria-labelledby="memo-close-title"><div><h3 id="memo-close-title">작성 중인 메모가 있습니다</h3><p>저장하지 않고 닫아도 작성 중인 내용은 이 사건의 임시 메모로 보관됩니다.</p><div><button type="button" autoFocus onClick={()=>setConfirmClose(false)}>계속 작성</button><button type="button" onClick={onClose}>임시 저장 후 닫기</button><button type="button" className="is-danger" onClick={discard}>작성 내용 버리기</button></div></div></div>}
    </section>;
  if(inline)return contentNode;
  return createPortal(<div className="memo-dialog-backdrop" onMouseDown={event=>event.target===event.currentTarget&&requestClose()}>{contentNode}</div>,document.body);
}

export function clearIncidentMemoDraft(incidentPublicId:string){
  try{sessionStorage.removeItem(memoDraftStorageKey(incidentPublicId))}catch{}
}
