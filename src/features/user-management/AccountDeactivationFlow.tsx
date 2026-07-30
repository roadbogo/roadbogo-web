"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {getRoleLabel} from "@/lib/auth/roleLabels";
import type {DeactivationCheckResult,ManagedUser,UserManagementAdapter,UserManagementError} from "./userManagementTypes";
import styles from "./AccountDeactivationFlow.module.css";
import {AdminCompactSelect} from "./AdminCompactSelect";

export const DEACTIVATION_REASON_TYPES=["퇴사 또는 계약 종료","담당 업무 변경","장기 미사용","보안 조치","중복 계정","기타"] as const;
export function buildDeactivationReason(type:string,detail:string){const trimmed=detail.trim();return trimmed?`${type} - ${trimmed}`:type}
export function validateDeactivationReason(type:string,detail:string){
  if(!type)return"사유 유형을 선택해 주세요.";
  if(type==="기타"&&!detail.trim())return"기타 사유의 상세 내용을 입력해 주세요.";
  if(detail.length>260)return"상세 사유는 260자 이내로 입력해 주세요.";
  return"";
}
export function isDeactivationDraftDirty(type:string,detail:string,confirmed:boolean){return Boolean(type||detail||confirmed)}

type EligibilityState="checking"|"allowed"|"blocked"|"error";
const blockedCopy=(result:DeactivationCheckResult)=>{
  if(result.blockReason==="SELF")return{title:"현재 로그인한 계정은 비활성화할 수 없습니다.",description:"본인 계정의 상태 변경은 다른 시스템 관리자에게 요청해 주세요."};
  if(result.blockReason==="ALREADY_INACTIVE")return{title:"이미 비활성 상태인 계정입니다.",description:"이 계정은 현재 신규 로그인이 차단된 상태입니다."};
  if(result.blockReason==="ACTIVE_ASSIGNMENT")return{title:"계정을 비활성화할 수 없습니다.",description:`현재 담당 중인 사건 또는 출동 업무가 있습니다${result.activeAssignments?` (${result.activeAssignments}건)`:""}. 담당 업무를 다른 사용자에게 재배정한 후 다시 시도해 주세요.`};
  return{title:"계정을 비활성화할 수 없습니다.",description:"이 계정은 마지막 활성 시스템 관리자입니다. 다른 활성 관리자 계정을 먼저 준비해 주세요."};
};

export function AccountDeactivationFlow({user,actorPublicId,adapter,onClose,onSuccess,onMissing,onDirtyChange}:{user:ManagedUser;actorPublicId:string;adapter:UserManagementAdapter;onClose:()=>void;onSuccess:(user:ManagedUser)=>void;onMissing:()=>void;onDirtyChange?:(dirty:boolean)=>void}){
  const [eligibility,setEligibility]=useState<EligibilityState>("checking"),[check,setCheck]=useState<DeactivationCheckResult|null>(null);
  const [reasonType,setReasonType]=useState(""),[detail,setDetail]=useState(""),[confirmed,setConfirmed]=useState(false),[submitting,setSubmitting]=useState(false),[error,setError]=useState("");
  const returnButton=useRef<HTMLButtonElement>(null),dirtyRef=useRef(false),onCloseRef=useRef(onClose),historyEntry=useRef(false),skipPop=useRef(false);
  const dirty=isDeactivationDraftDirty(reasonType,detail,confirmed),reasonError=useMemo(()=>validateDeactivationReason(reasonType,detail),[detail,reasonType]);
  const allowed=eligibility==="allowed"&&check?.allowed===true;
  const canSubmit=allowed&&!reasonError&&confirmed&&!submitting;
  const requestClose=useCallback(()=>{if(submitting)return;if(dirty&&!window.confirm("입력한 비활성화 사유가 저장되지 않습니다. 사용자 정보로 돌아갈까요?"))return;if(historyEntry.current){dirtyRef.current=false;window.history.back()}else onClose()},[dirty,onClose,submitting]);
  const verify=useCallback(async()=>{
    const controller=new AbortController();setEligibility("checking");setError("");
    try{const result=await adapter.checkDeactivation(user.publicId,actorPublicId,controller.signal);setCheck(result);setEligibility(result.allowed?"allowed":"blocked")}
    catch(caught){const managed=caught as UserManagementError;if(managed.code==="USER_NOT_FOUND"){onMissing();return}setEligibility("error");setError("비활성화 가능 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.")}
    return()=>controller.abort();
  },[actorPublicId,adapter,onMissing,user.publicId]);
  useEffect(()=>{void verify()},[verify]);
  useEffect(()=>{dirtyRef.current=dirty;onCloseRef.current=onClose},[dirty,onClose]);
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false)},[dirty,onDirtyChange]);
  useEffect(()=>{if(!dirty)return;const beforeUnload=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener("beforeunload",beforeUnload);return()=>window.removeEventListener("beforeunload",beforeUnload)},[dirty]);
  useEffect(()=>{
    if(!historyEntry.current){window.history.pushState({...window.history.state,deactivationReview:true},"",window.location.href);historyEntry.current=true}
    const pop=()=>{historyEntry.current=false;if(skipPop.current){skipPop.current=false;return}if(dirtyRef.current&&!window.confirm("입력한 비활성화 사유가 저장되지 않습니다. 사용자 정보로 돌아갈까요?")){skipPop.current=true;historyEntry.current=true;window.history.forward();return}onCloseRef.current()};
    window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop);
  },[]);
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")requestClose()};document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape)},[requestClose]);
  const submit=async()=>{
    if(!canSubmit)return;setSubmitting(true);setError("");
    try{
      const latest=await adapter.checkDeactivation(user.publicId,actorPublicId,new AbortController().signal);
      if(!latest.allowed){setCheck(latest);setEligibility("blocked");return}
      const updated=await adapter.deactivateUser(user.publicId,{reason:buildDeactivationReason(reasonType,detail)});
      if(historyEntry.current){skipPop.current=true;historyEntry.current=false;window.history.back()}
      onSuccess(updated);
    }catch(caught){
      const managed=caught as UserManagementError;
      if(managed.code==="USER_NOT_FOUND"){onMissing();return}
      if(managed.code==="USER_ACTIVE_ASSIGNMENT_EXISTS"){setCheck({user,allowed:false,blockReason:"ACTIVE_ASSIGNMENT",activeAssignments:user.activeAssignments});setEligibility("blocked");setError("진행 중인 업무가 있어 계정을 비활성화할 수 없습니다. 담당 업무를 먼저 재배정해 주세요.")}
      else if(managed.code==="USER_ALREADY_INACTIVE"){setCheck({user:{...user,accountStatus:"INACTIVE"},allowed:false,blockReason:"ALREADY_INACTIVE"});setEligibility("blocked");setError("계정 상태가 변경되었습니다. 최신 정보를 다시 확인해 주세요.")}
      else if(managed.code==="LAST_ACTIVE_SYSTEM_ADMIN"){setCheck({user,allowed:false,blockReason:"LAST_ACTIVE_ADMIN"});setEligibility("blocked")}
      else setError("계정을 비활성화하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }finally{setSubmitting(false)}
  };
  const block=check&&!check.allowed?blockedCopy(check):null;
  return <div className={styles.panel} aria-busy={submitting}>
    <header className={styles.head}><div><h2>계정 비활성화 검토</h2><p>대상 계정과 적용 영향을 확인한 뒤 비활성화 사유를 입력합니다.</p></div><button type="button" className={styles.mobileClose} aria-label="계정 비활성화 검토 닫기" onClick={requestClose}>×</button></header>
    <div className={styles.body}>
      <section className={styles.account} aria-labelledby="deactivation-account-title"><div><span>대상 계정</span><h3 id="deactivation-account-title">{user.userName}</h3><p>{user.email}</p></div><em data-active={user.accountStatus==="ACTIVE"}>● {user.accountStatus==="ACTIVE"?"활성":"비활성"}</em><dl><div><dt>현재 역할</dt><dd>{user.roles.map(getRoleLabel).join(", ")||"역할 미지정"}</dd></div><div><dt>소속</dt><dd>{user.organization?.name??"소속 미지정"}</dd></div></dl></section>
      <section className={styles.preflight}><h3>실행 전 확인</h3>{eligibility==="checking"?<p className={styles.checking}><i/> 계정 상태와 진행 중 업무를 확인하고 있습니다.</p>:eligibility==="error"?<div className={styles.blocked} role="alert"><strong>실행 가능 여부를 확인하지 못했습니다.</strong><p>{error}</p><button type="button" onClick={()=>void verify()}>다시 확인</button></div>:block?<div className={styles.blocked} role="alert"><strong>{block.title}</strong><p>{block.description}</p></div>:<ul><li><i/>관리자 본인의 계정이 아닙니다.</li><li><i/>현재 활성 상태인 계정입니다.</li><li><i/>진행 중인 사건·출동 업무가 없습니다.</li></ul>}<small>최종 실행 직전에 계정 상태와 진행 중 업무를 다시 확인합니다.</small></section>
      {allowed&&<><section className={styles.comparison}><h3>계정 상태 변경</h3><div><article><span>변경 전</span><strong>활성</strong><p>로그인 가능</p><p>세션 유지</p></article><article><span>변경 후</span><strong>비활성</strong><p>신규 로그인 차단</p><p>활성 세션 종료</p></article></div></section>
      <section className={styles.reason}><h3>비활성화 사유 *</h3><AdminCompactSelect label="사유 유형" value={reasonType as typeof DEACTIVATION_REASON_TYPES[number]|""} placeholder="사유 유형을 선택해 주세요." options={DEACTIVATION_REASON_TYPES.map(reason=>({value:reason,label:reason}))} onChange={value=>{setReasonType(value);setConfirmed(false)}}/><label htmlFor="deactivation-reason-detail">상세 사유<textarea id="deactivation-reason-detail" maxLength={260} value={detail} placeholder="비활성화 사유를 구체적으로 입력해 주세요." aria-describedby="deactivation-detail-help deactivation-reason-error" onChange={event=>{setDetail(event.target.value);setConfirmed(false)}}/><small id="deactivation-detail-help">{detail.length} / 260자 · 비밀번호나 민감정보를 입력하지 마세요.</small></label>{reasonError&&(reasonType||detail)&&<p id="deactivation-reason-error" className={styles.fieldError}>{reasonError}</p>}</section>
      <section className={styles.impact}><h3>적용되는 영향</h3><div><article><strong>즉시 적용</strong><ul><li>신규 로그인 차단</li><li>현재 활성 세션 전체 종료</li><li>계정 상태를 비활성으로 변경</li></ul></article><article><strong>유지되는 정보</strong><ul><li>기존 사건·출동 업무 이력</li><li>감사 및 책임 추적 기록</li><li>사용자 계정 정보</li></ul></article></div><p>계정 정보와 기존 업무 이력은 삭제되지 않습니다.</p></section>
      <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={Boolean(reasonError)} onChange={event=>setConfirmed(event.target.checked)}/><span>대상 계정과 비활성화 영향을 확인했습니다.</span></label></>}
      {error&&eligibility!=="error"&&<p className={styles.error} role="alert">{error}</p>}
    </div>
    <footer className={styles.foot}><button ref={returnButton} type="button" disabled={submitting} onClick={requestClose}>사용자 정보</button>{allowed&&<button type="button" className={styles.danger} disabled={!canSubmit} onClick={()=>void submit()}>{submitting?"처리 중…":"계정 비활성화"}</button>}</footer>
  </div>;
}
