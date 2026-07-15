"use client";
import { useState } from "react";

export function AccountRecoveryForm({mode}:{mode:"account"|"password"}){
 const[email,setEmail]=useState("");const[message,setMessage]=useState("");
 const submit=(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setMessage("현재 복구 API가 연결되지 않았습니다. 시스템 관리자에게 문의해 주세요.")};
 return <form onSubmit={submit}><label htmlFor="recovery-email">등록 이메일</label><input id="recovery-email" type="email" value={email} onChange={event=>setEmail(event.target.value)} required/><button type="submit">{mode==="account"?"계정 확인":"재설정 요청"}</button><p role="status">{message}</p></form>;
}
