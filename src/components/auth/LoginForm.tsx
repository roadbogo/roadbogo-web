"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { getRoleRedirect, getSafeNextPath } from "@/lib/auth/roleRedirect";
import type { AuthUser, LoginIntent } from "@/types/auth";
import { AUTH_EXPIRED_KEY, clearClientAuth, storeAuthUser } from "@/lib/auth/authStorage";
import { ApiError, storeAccessToken } from "@/lib/apiClient";
import { authApi, toAuthUser } from "@/lib/authApi";
import { PasswordField } from "./PasswordField";
import styles from "@/app/login/login.module.css";

const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function LoginForm({ intent }: { intent: LoginIntent }){
 const router=useRouter();const{ready,setAuthenticatedUser}=useAuth();
 const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[remember,setRemember]=useState(false);const[errors,setErrors]=useState<{email?:string;password?:string}>({});const[accountError,setAccountError]=useState("");const[isSubmitting,setIsSubmitting]=useState(false);const[isSuccess,setIsSuccess]=useState(false);const[pendingLogin,setPendingLogin]=useState<{user:AuthUser;accessToken:string}|null>(null);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get("reason")==="expired"||sessionStorage.getItem(AUTH_EXPIRED_KEY)==="true"){setAccountError("로그인 시간이 만료되었습니다. 안전한 이용을 위해 다시 로그인해주세요.");sessionStorage.removeItem(AUTH_EXPIRED_KEY)}},[]);
 useEffect(()=>{setAccountError("")},[intent]);
 const finishLogin=(user:AuthUser,destination?:string)=>{storeAuthUser(user);setAuthenticatedUser(user);router.replace(destination??getRoleRedirect(user.roles))};
 const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(isSubmitting)return;setAccountError("");setPendingLogin(null);if(!email.trim()){setErrors({email:"이메일을 입력해주세요."});return}if(!EMAIL_PATTERN.test(email.trim())){setErrors({email:"올바른 이메일 형식을 입력해주세요."});return}if(!password){setErrors({password:"비밀번호를 입력해주세요."});return}setErrors({});setIsSubmitting(true);try{const result=await authApi.login(email.trim(),password,remember);const user=toAuthUser(result.user);if(intent==="operations"&&user.roles.every(role=>role==="GENERAL_USER")){clearClientAuth();setPendingLogin({user,accessToken:result.access_token});setIsSubmitting(false);return}storeAccessToken(result.access_token);const params=new URLSearchParams(window.location.search);const destination=getSafeNextPath(params.get("next"))??getRoleRedirect(user.roles);setIsSuccess(true);finishLogin(user,destination)}catch(error){clearClientAuth();if(error instanceof ApiError){if(error.httpStatus===401)setAccountError("이메일 또는 비밀번호가 올바르지 않습니다.");else if(error.httpStatus===403)setAccountError("현재 사용할 수 없는 계정입니다. 관리자에게 문의해주세요.");else if(error.httpStatus===0)setAccountError("로그인 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");else setAccountError("로그인 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.")}else setAccountError("로그인 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");setIsSubmitting(false)}};
 const useGeneralService=()=>{if(!pendingLogin)return;storeAccessToken(pendingLogin.accessToken);finishLogin(pendingLogin.user,"/")};
 const handleAnotherAccount=async()=>{if(isSubmitting)return;setIsSubmitting(true);try{await authApi.logout()}catch{}finally{clearClientAuth();setPendingLogin(null);setPassword("");setIsSubmitting(false)}};
 return <form className={styles.form} onSubmit={submit} noValidate data-login-form>
  <div className={styles.field}><label htmlFor="email">이메일</label><input id="email" name="email" className={styles.input} type="email" inputMode="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username" aria-invalid={Boolean(errors.email)} aria-describedby="email-error" required/><p id="email-error" className={styles.fieldError} aria-live="polite">{errors.email??" "}</p></div>
  <PasswordField value={password} error={errors.password} onChange={setPassword}/>
  <div className={styles.formOptions}><label><input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)}/>로그인 상태 유지</label><nav aria-label="계정 복구"><Link href="/forgot-password">비밀번호 재설정</Link></nav></div>
  <p className={styles.commonError} role="alert" aria-live="polite">{!ready?"세션 복구 중...":accountError||" "}</p>
  {pendingLogin&&<section className={styles.accessMismatch} aria-live="polite"><strong>운영 시스템 접근 권한이 없습니다.</strong><p>이 계정은 일반 서비스 계정입니다.<br/>일반 서비스로 이동하시겠습니까?</p><div><button type="button" onClick={useGeneralService}>일반 서비스로 이동</button><button type="button" onClick={()=>void handleAnotherAccount()}>다른 계정으로 로그인</button></div></section>}
  <button className={`${styles.submit} ${intent==="operations"?styles.submitOperations:""}`} data-login-submit type="submit" disabled={isSubmitting||!ready||Boolean(pendingLogin)} aria-busy={isSubmitting}>{isSuccess?<svg className={styles.successIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>:isSubmitting&&<span className={styles.spinner} aria-hidden="true"/>}{isSuccess?"접속 중...":isSubmitting?"로그인 중...":intent==="operations"?"운영 계정으로 로그인":"로그인"}</button>
 </form>;
}
