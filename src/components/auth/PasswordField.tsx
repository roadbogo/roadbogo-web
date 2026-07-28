"use client";
import { useState } from "react";
import styles from "@/app/login/login.module.css";

type Props={fieldPrefix:string;autoCompleteSection:string;value:string;error?:string;onChange:(value:string)=>void};
export function PasswordField({fieldPrefix,autoCompleteSection,value,error,onChange}:Props){
 const[visible,setVisible]=useState(false);
 const passwordId=`${fieldPrefix}-password`;
 const errorId=`${passwordId}-error`;
 return <div className={styles.field}><label htmlFor={passwordId}>비밀번호</label><div className={styles.inputWrap}><input id={passwordId} name={passwordId} className={`${styles.input} ${styles.passwordInput}`} type={visible?"text":"password"} value={value} onChange={event=>onChange(event.target.value)} autoComplete={`section-${autoCompleteSection} current-password`} aria-invalid={Boolean(error)} aria-describedby={errorId} required/><button className={styles.passwordToggle} type="button" onClick={()=>setVisible(value=>!value)} aria-label={visible?"비밀번호 숨기기":"비밀번호 표시"} aria-pressed={visible}>{visible?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a17 17 0 0 1-2.1 2.5M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5c1 0 1.9-.2 2.7-.4"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z"/><circle cx="12" cy="12" r="2.5"/></svg>}</button></div><p id={errorId} className={styles.fieldError} aria-live="polite">{error??" "}</p></div>;
}
