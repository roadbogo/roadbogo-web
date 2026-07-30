"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useAuth} from "@/components/auth/AuthContext";
import styles from "./adminLocalNavigation.module.css";

type AdminDestination={label:string;href:string;permission?:string};
const destinations:AdminDestination[]=[
  {label:"관리 콘솔",href:"/admin"},
  {label:"사용자 관리",href:"/admin/users",permission:"USER.READ_ALL"},
  {label:"역할·권한",href:"/admin/roles",permission:"ROLE.MANAGE"},
  {label:"CCTV 자산",href:"/admin/cctvs",permission:"CCTV.READ"},
  {label:"감사 로그",href:"/admin/audit-logs",permission:"AUDIT.READ"},
];

function active(pathname:string,href:string){
  return href==="/admin"?pathname==="/admin":pathname===href||pathname.startsWith(`${href}/`);
}

export function AdminLocalNavigation(){
  const{user}=useAuth(),pathname=usePathname();
  const permissions=new Set(user?.apiPermissions??[]);
  const visible=destinations.filter(item=>!item.permission||permissions.has(item.permission));
  const current=visible.find(item=>active(pathname,item.href))??visible[0];
  return <nav className={styles.nav} aria-label="시스템 관리자 화면">
    <div className={styles.desktop}>{visible.map(item=><Link key={item.href} href={item.href} aria-current={active(pathname,item.href)?"page":undefined}>{item.label}</Link>)}</div>
    <details className={styles.mobile}>
      <summary><span>관리 화면</span><strong>{current?.label??"관리 콘솔"}</strong></summary>
      <div>{visible.map(item=><Link key={item.href} href={item.href} aria-current={active(pathname,item.href)?"page":undefined}>{item.label}</Link>)}</div>
    </details>
  </nav>;
}
