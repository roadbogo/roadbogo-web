"use client";

import {useState} from "react";
import {getRoleLabel} from "@/lib/auth/roleLabels";
import type {ManagedUser,UserManagementAdapter} from "./userManagementTypes";

type Styles=Record<string,string>;
const format=(value:string)=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));

export function AccountActivationReview({user,adapter,styles,onClose,onSuccess}:{user:ManagedUser;adapter:UserManagementAdapter;styles:Styles;onClose:()=>void;onSuccess:(user:ManagedUser)=>void}){
  const[reviewing,setReviewing]=useState(false),[reason,setReason]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState("");
  const available=Boolean(user.deactivatedAt);
  const deactivation=user.changes.find(item=>item.action.includes("비활성"));
  const dirty=reviewing&&reason.length>0;
  const close=()=>{if(dirty&&!window.confirm("입력한 활성화 사유가 저장되지 않습니다. 사용자 목록으로 돌아갈까요?"))return;onClose()};
  const submit=async()=>{const normalized=reason.trim().replace(/\n{3,}/g,"\n\n");if(normalized.length<5){setError("활성화 사유를 5자 이상 입력해 주세요.");return}if(saving)return;setSaving(true);setError("");try{onSuccess(await adapter.activateUser(user.publicId,{reason:normalized}))}catch(caught){setError(caught instanceof Error?caught.message:"계정을 활성화하지 못했습니다. 잠시 후 다시 시도해 주세요.")}finally{setSaving(false)}};
  return <div className={styles.activationReview} aria-busy={saving}>
    <header className={styles.inspectorHead}><div><span className={available?styles.recoveryAvailable:styles.recoveryReview}>{available?"✓ 복구 가능":"! 확인 필요"}</span><h2>비활성 계정 검토</h2><p>{user.userName} · {user.email}</p></div><button type="button" aria-label="비활성 계정 검토 닫기" onClick={close}>×</button></header>
    <div className={styles.activationBody}>
      <section><h3>사용자 요약</h3><strong>{user.userName}</strong><p>{user.email}</p><p>{available?"관리자에 의해 비활성화된 계정입니다.":"현재 기록만으로 복구 가능 여부를 확인할 수 없습니다."}</p></section>
      <section><h3>비활성화 정보</h3><dl><div><dt>비활성화 시각</dt><dd>{user.deactivatedAt?`${format(user.deactivatedAt)} KST`:"기록 없음"}</dd></div><div><dt>처리자</dt><dd>{deactivation?.actor??"확인 필요"}</dd></div><div><dt>사유</dt><dd>{deactivation?.summary??"기록 없음"}</dd></div></dl></section>
      <section><h3>현재 계정 정보</h3><dl><div><dt>역할</dt><dd>{user.roles.map(getRoleLabel).join(", ")||"역할 없음"}</dd></div><div><dt>소속</dt><dd>{user.organization?.name??"소속 없음"}</dd></div></dl></section>
      {available?<><section><h3>복구 전 점검</h3><ul><li>✓ 관리자 비활성화 계정</li><li>✓ 기존 역할 유지</li><li>✓ 기존 소속 유지</li><li>! 기존 로그인 세션은 복구되지 않음</li>{!user.roles.length&&<li>! 역할 확인 필요</li>}{user.roles.some(role=>role!=="GENERAL_USER")&&!user.organization&&<li>! 운영 계정 소속 확인 필요</li>}</ul></section>
      <section><h3>활성화 후 변경</h3><dl><div><dt>계정 상태</dt><dd>비활성 → 활성</dd></div><div><dt>역할</dt><dd>{user.roles.map(getRoleLabel).join(", ")||"역할 없음"} 유지</dd></div><div><dt>소속</dt><dd>{user.organization?.name??"소속 없음"} 유지</dd></div><div><dt>로그인</dt><dd>새로 로그인 필요</dd></div></dl></section>
      {!reviewing?<button type="button" className={styles.activationPrimary} onClick={()=>setReviewing(true)}>계정 활성화 검토</button>:<section className={styles.activationForm}><h3>계정 활성화 확인</h3><p><b>대상 · {user.userName}</b></p><label><span>활성화 사유 *</span><textarea value={reason} maxLength={200} onChange={event=>{setReason(event.target.value);setError("")}} placeholder="업무 복귀, 잘못된 비활성화 복구 등 활성화 사유를 입력해 주세요."/></label><small>{reason.length} / 200자</small>{error&&<p role="alert" className={styles.saveError}>{error}</p>}<p>활성화하면 다시 로그인할 수 있으며 기존 역할과 소속은 유지됩니다. 기존 로그인 세션은 복구되지 않습니다.</p><footer><button type="button" disabled={saving} onClick={()=>{setReviewing(false);setReason("");setError("")}}>돌아가기</button><button type="button" className={styles.activationPrimary} disabled={saving||reason.trim().length<5} onClick={()=>void submit()}>{saving?"처리 중…":"계정 활성화"}</button></footer></section>}</>:<section className={styles.recoveryBlocked}><h3>복구 가능 여부를 확인할 수 없습니다.</h3><p>현재 기록만으로 관리자 비활성화 계정인지 회원탈퇴 계정인지 구분할 수 없습니다.</p></section>}
    </div>
  </div>;
}
