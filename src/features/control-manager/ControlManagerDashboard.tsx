"use client";

import Link from"next/link";
import{useCallback,useEffect,useMemo,useState}from"react";
import{useAuth}from"@/components/auth/AuthContext";
import{LandingHeader}from"@/components/landing/LandingHeader";
import{createDashboardAdapter}from"@/features/control-dashboard/dashboardAdapterFactory";
import{incidentStatusLabel,relativeTime,riskLabel}from"@/features/control-dashboard/dashboardDomain";
import{objectCategoryLabel}from"@/features/control-dashboard/dashboardMapper";
import type{DashboardIncident,DashboardSnapshot}from"@/features/control-dashboard/dashboardTypes";
import{getAttentionKinds,selectControlManagerSummary,selectControllerWorkloads,selectManagerAttentionIncidents,selectResponseFlow,type ManagerAttentionKind}from"./controlManagerSelectors";
import styles from"./controlManagerDashboard.module.css";

const adapter=createDashboardAdapter();
const attentionLabels:Record<ManagerAttentionKind,string>={urgent:"미확인 긴급",unassigned:"담당 미배정",dispatch:"출동 확인",closure:"종료 대기"};
const tabs:{key:ManagerAttentionKind|"all";label:string}[]=[{key:"all",label:"전체"},{key:"urgent",label:"미확인 긴급"},{key:"unassigned",label:"담당 미배정"},{key:"dispatch",label:"출동 확인"},{key:"closure",label:"종료 대기"}];
const flowLabels={intake:"신규 접수",review:"관제 검토",dispatch:"출동 요청",field:"현장 대응",closure:"종료 확인"} as const;
const Icon=({kind}:{kind:"urgent"|"user"|"dispatch"|"closure"})=><svg viewBox="0 0 24 24" aria-hidden="true">{kind==="urgent"?<><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></>:kind==="user"?<><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m3-13v7m-3-3h6"/></>:kind==="dispatch"?<><path d="M3 16V9a7 7 0 0 1 14 0v7M2 16h18M7 20h8"/><path d="M10 3V1m-6 4 2 2m12-2-2 2"/></>:<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>}</svg>;

export function ControlManagerDashboard(){
 const{user}=useAuth(),[data,setData]=useState<DashboardSnapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[filter,setFilter]=useState<ManagerAttentionKind|"all">("all");
 const load=useCallback(()=>{setLoading(true);setError("");void adapter.load().then(setData).catch(()=>setError("센터 운영 현황을 불러오지 못했습니다.")).finally(()=>setLoading(false))},[]);
 useEffect(load,[load]);
 const allowed=Boolean(user?.roles.includes("CONTROL_MANAGER")&&user.apiPermissions.includes("INCIDENT.READ_ALL"));
 const summary=useMemo(()=>data?selectControlManagerSummary(data):null,[data]);
 const attention=useMemo(()=>data?selectManagerAttentionIncidents(data,filter).slice(0,5):[],[data,filter]);
 const workloads=useMemo(()=>data?selectControllerWorkloads(data):[],[data]);
 const flow=useMemo(()=>data?selectResponseFlow(data):[],[data]);
 if(!allowed)return <><LandingHeader showSections={false}/><main className={styles.restricted} role="alert"><strong>관제센터 운영 화면에 접근할 권한이 없습니다.</strong><p>관제센터 책임자 역할과 사건 전체 조회 권한을 확인해 주세요.</p></main></>;
 return <div className={styles.page}><LandingHeader showSections={false}/><main className={styles.main}>
  <header className={styles.header}><div><h1>관제센터 운영</h1><p>관제센터 전체의 사건 처리와 출동 대응 현황을 관리합니다.</p></div><div className={styles.meta}><span className={styles.roleBadge}>관제센터 책임자</span><time>{data?`최근 갱신 ${relativeTime(data.fetched_at)}`:"갱신 확인 중"}</time></div></header>
  {error?<section className={styles.loadState} role="alert"><strong>{error}</strong><button onClick={load}>다시 조회</button></section>:loading||!summary?<section className={styles.loadState} role="status">센터 운영 현황을 불러오는 중입니다.</section>:<>
   <section className={styles.summary} aria-label="센터 핵심 현황">
    <SummaryCard kind="urgent" label="미확인 긴급" count={summary.urgentUnacknowledgedCount} copy="즉시 확인이 필요한 사건"/>
    <SummaryCard kind="user" label="담당 미배정" count={summary.unassignedCount} copy="담당 확인이 필요한 사건"/>
    <SummaryCard kind="dispatch" label="출동 확인 필요" count={summary.dispatchAttentionCount} copy="응답 대기 또는 거절된 요청"/>
    <SummaryCard kind="closure" label="종료 확인 대기" count={summary.closurePendingCount} copy="현장 조치 완료 후 종료 대기"/>
   </section>
   <div className={styles.operations}>
    <section className={styles.attention}><SectionHeader title="책임자 확인 필요" copy="담당 조정이나 확인이 필요한 사건입니다."/><div className={styles.tabs} role="tablist" aria-label="책임자 확인 사건 필터">{tabs.map(tab=><button role="tab" aria-selected={filter===tab.key} key={tab.key} onClick={()=>setFilter(tab.key)}>{tab.label}</button>)}</div>{attention.length?<div className={styles.incidents}>{attention.map(item=><IncidentRow key={item.public_id} incident={item} snapshot={data!}/>)}</div>:<p className={styles.empty}>현재 책임자 확인이 필요한 사건이 없습니다.</p>}<Link className={styles.sectionLink} href="/control/incidents">전체 사건 보기</Link></section>
    <section className={styles.workloads}><SectionHeader title="관제 담당 현황" copy="담당자별 진행 사건을 확인합니다."/>{workloads.length?<div className={styles.workloadList}>{workloads.map(item=><article key={item.userPublicId}><div><span className={styles.avatar}>{item.userName.charAt(0)}</span><div><strong>{item.userName}</strong><small>담당 {item.assignedCount}건</small></div></div><p>검토 중 {item.reviewingCount} · 출동 연계 {item.dispatchLinkedCount} · 종료 대기 {item.closurePendingCount}</p><footer><time>{item.lastActivityAt?`최근 처리 ${relativeTime(item.lastActivityAt)}`:"최근 처리 기록 없음"}</time><Link href="/control/incidents">담당 사건 보기</Link></footer></article>)}</div>:<p className={styles.empty}>표시할 관제 담당 현황이 없습니다.</p>}</section>
   </div>
   <section className={styles.flow}><SectionHeader title="전체 대응 흐름" copy="현재 진행 중인 사건의 단계별 분포입니다."/><div>{flow.map((item,index)=><Link href="/control/incidents" key={item.key}><span>{index+1}</span><small>{flowLabels[item.key]}</small><strong>{item.count}건</strong></Link>)}</div></section>
  </>}
 </main></div>;
}
function SummaryCard({kind,label,count,copy}:{kind:"urgent"|"user"|"dispatch"|"closure";label:string;count:number;copy:string}){return <article className={styles.summaryCard} data-kind={kind}><i><Icon kind={kind}/></i><span>{label}</span><strong>{count}</strong><p>{copy}</p></article>}
function SectionHeader({title,copy}:{title:string;copy:string}){return <header className={styles.sectionHeader}><h2>{title}</h2><p>{copy}</p></header>}
function IncidentRow({incident,snapshot}:{incident:DashboardIncident;snapshot:DashboardSnapshot}){const cctv=snapshot.cctvs.find(item=>item.public_id===incident.cctv_public_id),kinds=getAttentionKinds(incident,new Set(snapshot.dispatches.filter(item=>item.status==="REQUESTED"||item.status==="REJECTED").map(item=>item.incident_public_id)));return <article className={styles.incidentRow}><div className={styles.incidentBadges}><span data-risk={incident.current_risk_grade}>{riskLabel[incident.current_risk_grade]}</span><span>{incidentStatusLabel[incident.status]}</span></div><div className={styles.incidentMain}><strong>{objectCategoryLabel[incident.object_category]} · {incident.class_name??"분류 정보 없음"}</strong><small>{incident.incident_no}</small><p>{cctv?`${cctv.road.road_name} · ${cctv.road_section.section_name}`:"위치 정보 없음"}</p></div><div className={styles.assignment}><strong>{kinds.map(kind=>attentionLabels[kind]).join(" · ")}</strong><span>{incident.assigned_controller?.display_name??"담당 미배정"}</span><time>{relativeTime(incident.updated_at)}</time></div><Link href={`/control/incidents/${incident.public_id}`}>상세 보기</Link></article>}
