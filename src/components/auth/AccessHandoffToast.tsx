"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { consumeAccessHandoff } from "@/lib/auth/accessHandoff";

export function AccessHandoffToast(){
  const pathname=usePathname();
  const[message,setMessage]=useState("");
  useEffect(()=>{
    const handoff=consumeAccessHandoff();
    if(!handoff)return;
    setMessage(handoff.message);
    const timer=window.setTimeout(()=>setMessage(""),5200);
    return()=>window.clearTimeout(timer);
  },[pathname]);
  if(!message)return null;
  return <div className="access-handoff-toast" role="status" aria-live="polite">
    <span aria-hidden="true">i</span>
    <p>{message}</p>
    <button type="button" onClick={()=>setMessage("")} aria-label="안내 닫기">×</button>
  </div>;
}
