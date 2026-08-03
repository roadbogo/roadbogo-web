"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useAuth} from "@/components/auth/AuthContext";
import styles from "./adminLocalNavigation.module.css";

type IconKind="home"|"users"|"roles"|"cctv"|"audit";
type AdminDestination={label:string;href:string;icon:IconKind;permission?:string};

const destinations:AdminDestination[]=[
  {label:"관리 홈",href:"/admin",icon:"home"},
  {label:"사용자 관리",href:"/admin/users",icon:"users",permission:"USER.READ_ALL"},
  {label:"역할 및 권한",href:"/admin/roles",icon:"roles",permission:"ROLE.MANAGE"},
  {label:"CCTV 조회",href:"/admin/cctvs",icon:"cctv",permission:"CCTV.READ"},
  {label:"감사 로그",href:"/admin/audit-logs",icon:"audit",permission:"AUDIT.READ"},
];

function NavIcon({kind}:{kind:IconKind}){
  if(kind==="home") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><path d="M9 20v-6h6v6"/></svg>;
  if(kind==="users") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 6.5a3 3 0 0 1 0 5.5M17 14a5 5 0 0 1 3.5 5"/></svg>;
  if(kind==="roles") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/></svg>;
  if(kind==="cctv") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="12" rx="2"/><path d="M8 21h8M12 17v4M8 9.5h8"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3 3V20H6z"/><path d="M15 3.5V7h3M9 11h6M9 15h6"/></svg>;
}

function active(pathname:string,href:string){
  return href==="/admin"?pathname==="/admin":pathname===href||pathname.startsWith(`${href}/`);
}

export function AdminLocalNavigation(){
  const{user}=useAuth(),pathname=usePathname();
  const permissions=new Set(user?.apiPermissions??[]);
  const visible=destinations.filter(item=>!item.permission||permissions.has(item.permission));
  const current=visible.find(item=>active(pathname,item.href))??visible[0];
  return <nav className={styles.nav} aria-label="시스템 관리자 화면">
    <div className={styles.desktop}>{visible.map(item=><Link key={item.href} href={item.href} aria-current={active(pathname,item.href)?"page":undefined}><NavIcon kind={item.icon}/><span>{item.label}</span></Link>)}</div>
    <details className={styles.mobile}>
      <summary><span>관리 화면</span><strong>{current?.label??"관리 홈"}</strong></summary>
      <div>{visible.map(item=><Link key={item.href} href={item.href} aria-current={active(pathname,item.href)?"page":undefined}><NavIcon kind={item.icon}/><span>{item.label}</span></Link>)}</div>
    </details>
  </nav>;
}
