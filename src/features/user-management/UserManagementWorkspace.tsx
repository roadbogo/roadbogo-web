"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { getRoleLabel } from "@/lib/auth/roleLabels";
import type { UserRole } from "@/types/auth";
import { createUserManagementAdapter } from "./mockUserManagementAdapter";
import { OrganizationExplorer, type OrganizationExplorerValue } from "./OrganizationExplorer";
import {formatAdminPhone,normalizeAdminPhone} from "./CreateUserWizard";
import {normalizeUserDirectoryPageSize,USER_DIRECTORY_PAGE_SIZES} from "./userManagementTypes";
import type { AccountStatus, ManagedUser, OrganizationOption, UserAttentionReason, UserListQuery, UserListResult, UserWorkView } from "./userManagementTypes";
import type {UpdateAdminUserInput} from "./userManagementTypes";
import {RoleBadgeGroup,RoleDescription,RoleLegendPopover} from "./RolePresentation";
import {ROLE_ORDER,ROLE_PRESENTATIONS,ROLE_SYMBOLS,sortRoles} from "./rolePresentationConfig";
import {AccountDeactivationFlow} from "./AccountDeactivationFlow";
import {AccountActivationReview} from "./AccountActivationReview";
import {getUserPaginationItems,PaginationChevron,UserPageSizeSelect} from "./UserDirectoryPagination";

type Styles=Record<string,string>;
type InspectorTab="basic"|"roles"|"changes";
type EditDraft={userName:string;phone:string;organizationPublicId:string};
const roleOrder:UserRole[]=ROLE_ORDER;
const validRoles=new Set(roleOrder);
const workViews:UserWorkView[]=["all","operating","general","attention","inactive"];
const validViews=new Set<UserWorkView>(workViews);
const viewLabels:Record<UserWorkView,string>={all:"전체",operating:"운영 계정",general:"일반 사용자",attention:"검토 필요",inactive:"비활성"};
const statusLabel:Record<AccountStatus,string>={ACTIVE:"활성",INACTIVE:"비활성"};
const attentionReasons=new Set<UserAttentionReason>(["unassigned","never-logged-in","no-organization"]);

function parsePositive(value:string|null,fallback:number){const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:fallback}
function formatKst(value:string){return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value))}
function formatPhone(value:string|null){
  if(!value)return"등록되지 않음";
  const digits=value.replace(/\D/g,"");
  if(digits.startsWith("82")&&digits.length>=11)return`+82 ${digits.slice(2,4)}-${digits.slice(4,8)}-${digits.slice(8)}`;
  return digits.length===11?`${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`:value;
}
function userChecks(user:ManagedUser){const checks=[];if(user.roles.length===0)checks.push("역할 미지정");if(user.roles.some(role=>role!=="GENERAL_USER")&&!user.lastLoginAt)checks.push("로그인 기록 없음");if(user.roles.some(role=>role!=="GENERAL_USER")&&!user.organization)checks.push("소속 미지정");if((user.activeAssignments??0)>0)checks.push(`활성 업무 ${user.activeAssignments}건`);return checks}
export function buildUserUpdatePatch(user:ManagedUser,draft:EditDraft):UpdateAdminUserInput{
 const patch:UpdateAdminUserInput={},name=draft.userName.trim(),phone=normalizeAdminPhone(draft.phone),originalPhone=normalizeAdminPhone(user.phone??"");
 if(name!==user.userName.trim())patch.userName=name;
 if(phone!==originalPhone)patch.phone=phone||null;
 if(draft.organizationPublicId!==user.organization?.publicId)patch.organizationPublicId=draft.organizationPublicId;
 return patch;
}

export function UserManagementWorkspace({styles}:{styles:Styles}){
  const router=useRouter(),pathname=usePathname(),params=useSearchParams();
  const{user:currentUser}=useAuth();
  const adapter=useMemo(()=>createUserManagementAdapter(),[]);
  const query=useMemo<UserListQuery>(()=>{
    const rawRole=params.get("role"),rawStatus=params.get("account_status"),rawSort=params.get("sort"),rawView=params.get("view");
    const view=rawView&&validViews.has(rawView as UserWorkView)?rawView as UserWorkView:"all";
    const requestedSize=normalizeUserDirectoryPageSize(params.get("size")),rawIssue=params.get("issue");
    return{page:parsePositive(params.get("page"),1),size:requestedSize,keyword:(params.get("keyword")??"").trim(),view,attentionReason:rawIssue&&attentionReasons.has(rawIssue as UserAttentionReason)?rawIssue as UserAttentionReason:null,role:rawRole&&validRoles.has(rawRole as UserRole)?rawRole as UserRole:null,accountStatus:rawStatus==="ACTIVE"||rawStatus==="INACTIVE"?rawStatus:null,organizationPublicId:params.get("organization_public_id"),organizationUnassigned:params.get("organization_unassigned")==="true",sort:rawSort==="created_at,asc"?"created_at,asc":"created_at,desc"};
  },[params]);
  const selectedId=params.get("user"),requestedTab=params.get("tab");
  const [keyword,setKeyword]=useState(query.keyword);
  const [result,setResult]=useState<UserListResult|null>(null);
  const [organizations,setOrganizations]=useState<OrganizationOption[]>([]);
  const [organizationsLoading,setOrganizationsLoading]=useState(true);
  const [organizationsError,setOrganizationsError]=useState(false);
  const [listLoading,setListLoading]=useState(true);
  const [listError,setListError]=useState(false);
  const [detail,setDetail]=useState<ManagedUser|null>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [detailMissing,setDetailMissing]=useState(false);
  const [tab,setTab]=useState<InspectorTab>("basic");
  const [roleEditing,setRoleEditing]=useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [inspectorMode,setInspectorMode]=useState<"view"|"edit"|"saving">("view");
  const [draft,setDraft]=useState<EditDraft|null>(null);
  const [editErrors,setEditErrors]=useState<Record<string,string>>({});
  const [saveError,setSaveError]=useState("");
  const [notice,setNotice]=useState("");
  const [deactivationOpen,setDeactivationOpen]=useState(false);
  const [deactivationDirty,setDeactivationDirty]=useState(false);
  const listController=useRef<AbortController|null>(null),detailController=useRef<AbortController|null>(null);
  const listTop=useRef<HTMLElement|null>(null),lastSelected=useRef<HTMLButtonElement|null>(null),inspectorRef=useRef<HTMLElement|null>(null),filterTrigger=useRef<HTMLButtonElement|null>(null),composing=useRef(false);

  const updateQuery=useCallback((updates:Record<string,string|null>,mode:"replace"|"push"="replace")=>{
    const next=new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key,value])=>value&&value!==("page"===key?"1":"")?next.set(key,value):next.delete(key));
    const url=`${pathname}${next.size?`?${next.toString()}`:""}`;
    if(mode==="push")router.push(url,{scroll:false});
    else router.replace(url,{scroll:false});
  },[params,pathname,router]);

  useEffect(()=>setKeyword(query.keyword),[query.keyword]);
  useEffect(()=>{const raw=params.get("size");if(raw&&!USER_DIRECTORY_PAGE_SIZES.includes(Number(raw) as typeof USER_DIRECTORY_PAGE_SIZES[number]))updateQuery({size:null,page:null,user:null})},[params,updateQuery]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{const normalized=keyword.trim();if(!composing.current&&normalized!==query.keyword)updateQuery({keyword:normalized||null,page:null,user:null})},400);
    return()=>window.clearTimeout(timer);
  },[keyword,query.keyword,updateQuery]);
  const loadOrganizations=useCallback((controller:AbortController)=>{
    setOrganizationsLoading(true);setOrganizationsError(false);
    void adapter.listOrganizations(controller.signal).then(setOrganizations).catch(error=>{if(!(error instanceof DOMException&&error.name==="AbortError"))setOrganizationsError(true)}).finally(()=>{if(!controller.signal.aborted)setOrganizationsLoading(false)});
  },[adapter]);
  useEffect(()=>{const controller=new AbortController();loadOrganizations(controller);return()=>controller.abort()},[loadOrganizations]);
  useEffect(()=>{if(organizations.length&&query.organizationPublicId&&!organizations.some(item=>item.publicId===query.organizationPublicId&&item.isActive!==false))updateQuery({organization_public_id:null,page:null,user:null})},[organizations,query.organizationPublicId,updateQuery]);
  const loadList=useCallback(async()=>{
    listController.current?.abort();const controller=new AbortController();listController.current=controller;
    setListLoading(true);setListError(false);
    try{const next=await adapter.listUsers(query,controller.signal);setResult(next)}
    catch(error){if(!(error instanceof DOMException&&error.name==="AbortError"))setListError(true)}
    finally{if(!controller.signal.aborted)setListLoading(false)}
  },[adapter,query]);
  useEffect(()=>{void loadList();return()=>listController.current?.abort()},[loadList]);
  useEffect(()=>{if(!result)return;const last=Math.max(1,result.pagination.totalPages);if(query.page>last)updateQuery({page:String(last),user:null})},[query.page,result,updateQuery]);
  useEffect(()=>{if(result&&selectedId&&!result.items.some(item=>item.publicId===selectedId))updateQuery({user:null})},[result,selectedId,updateQuery]);
  useEffect(()=>{
    setTab(requestedTab==="roles"?"roles":"basic");setRoleEditing(false);setDetailMissing(false);setInspectorMode("view");setDraft(null);setEditErrors({});setSaveError("");
    if(!selectedId){setDetail(null);return}
    detailController.current?.abort();const controller=new AbortController();detailController.current=controller;setDetailLoading(true);
    void adapter.getUserDetail(selectedId,controller.signal).then(next=>{if(!controller.signal.aborted){setDetail(next);setDetailMissing(!next)}}).catch(error=>{if(!(error instanceof DOMException&&error.name==="AbortError"))setDetailMissing(true)}).finally(()=>{if(!controller.signal.aborted)setDetailLoading(false)});
    return()=>controller.abort();
  },[adapter,requestedTab,selectedId]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key!=="Escape"||!selectedId)return;const dirty=Boolean(detail&&draft&&Object.keys(buildUserUpdatePatch(detail,draft)).length);if(dirty&&!window.confirm("저장하지 않은 변경사항이 있습니다.\n수정을 취소하고 변경사항을 버리시겠습니까?"))return;updateQuery({user:null})};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[detail,draft,selectedId,updateQuery]);
  useEffect(()=>{if(selectedId)window.requestAnimationFrame(()=>inspectorRef.current?.querySelector<HTMLElement>("button,[href]")?.focus())},[selectedId]);

  const chips=[
    query.attentionReason?["issue",query.attentionReason==="unassigned"?"역할 미지정":query.attentionReason==="never-logged-in"?"로그인 기록 없음":"소속 미지정"]:null,
    query.keyword?["keyword",`검색: ${query.keyword}`]:null,
    query.role?["role",getRoleLabel(query.role)]:null,
    query.accountStatus?["account_status",statusLabel[query.accountStatus]]:null,
    query.organizationPublicId?["organization_public_id",organizations.find(item=>item.publicId===query.organizationPublicId)?.name??"소속"]:null,
    query.organizationUnassigned?["organization_unassigned","소속 미지정"]:null,
    query.sort==="created_at,asc"?["sort","오래된 등록순"]:null,
  ].filter(Boolean) as string[][];
  const editDirty=Boolean(detail&&draft&&Object.keys(buildUserUpdatePatch(detail,draft)).length);
  const confirmDiscard=()=>!editDirty||window.confirm("저장하지 않은 변경사항이 있습니다.\n수정을 취소하고 변경사항을 버리시겠습니까?");
  const confirmDeactivationDiscard=()=>!deactivationOpen||!deactivationDirty||window.confirm("입력한 비활성화 사유가 저장되지 않습니다. 사용자 정보로 돌아갈까요?");
  const choose=(item:ManagedUser,eventTarget:HTMLButtonElement)=>{if(!confirmDiscard()||!confirmDeactivationDiscard())return;setDeactivationOpen(false);lastSelected.current=eventTarget;updateQuery({user:item.publicId},"push")};
  const closeInspector=()=>{if(!confirmDiscard()||!confirmDeactivationDiscard())return;setDeactivationOpen(false);updateQuery({user:null});window.requestAnimationFrame(()=>lastSelected.current?.focus())};
  const canWrite=currentUser?.apiPermissions.includes("USER.WRITE")??false;
  const canManageRoles=currentUser?.apiPermissions.includes("ROLE.MANAGE")??false;
  const hasConditions=Boolean(query.attentionReason||query.keyword||query.role||query.accountStatus||query.organizationPublicId||query.organizationUnassigned||query.sort!=="created_at,desc");
  const clearAll=()=>{setKeyword("");updateQuery({issue:null,keyword:null,role:null,account_status:null,organization_public_id:null,organization_unassigned:null,sort:null,page:null,user:null})};
  const closeFilters=()=>{setFiltersOpen(false);requestAnimationFrame(()=>filterTrigger.current?.focus())};
  const attentionFilters=result?[{key:"unassigned" as const,label:"역할 미지정",count:result.summary.unassigned},{key:"never-logged-in" as const,label:"로그인 기록 없음",count:result.summary.neverLoggedIn},{key:"no-organization" as const,label:"소속 미지정",count:result.summary.withoutOrganization}]:[];
  const beginEdit=()=>{if(!detail)return;setDraft({userName:detail.userName,phone:formatAdminPhone(detail.phone??""),organizationPublicId:detail.organization?.publicId??""});setEditErrors({});setSaveError("");setInspectorMode("edit")};
  const cancelEdit=()=>{if(confirmDiscard()){setInspectorMode("view");setDraft(null);setEditErrors({});setSaveError("")}};
  const saveEdit=async()=>{if(!detail||!draft||inspectorMode==="saving")return;const errors:Record<string,string>={};const name=draft.userName.trim();if(!name)errors.userName="사용자명을 입력해 주세요.";else if(name.length<2||name.length>100)errors.userName="사용자명은 2자 이상 100자 이하로 입력해 주세요.";if(draft.phone&&normalizeAdminPhone(draft.phone).length!==11)errors.phone="전화번호 11자리를 입력해 주세요.";if(!draft.organizationPublicId)errors.organization="소속 기관을 선택해 주세요.";setEditErrors(errors);if(Object.keys(errors).length){const first=errors.userName?"edit-user-name":errors.phone?"edit-user-phone":"edit-user-org";requestAnimationFrame(()=>document.getElementById(first)?.focus());return}const patch=buildUserUpdatePatch(detail,draft);if(!Object.keys(patch).length)return;setInspectorMode("saving");setSaveError("");try{const updated=await adapter.updateUser(detail.publicId,patch);setDetail(updated);setResult(current=>current?{...current,items:current.items.map(item=>item.publicId===updated.publicId?updated:item)}:current);setDraft(null);setInspectorMode("view");const excluded=query.organizationPublicId&&updated.organization?.publicId!==query.organizationPublicId||query.organizationUnassigned&&Boolean(updated.organization);if(excluded){setNotice("사용자 정보가 수정되어 현재 필터 결과에서 제외되었습니다.");updateQuery({user:null})}else setNotice("사용자 정보가 수정되었습니다.");void loadList()}catch(error){setInspectorMode("edit");setSaveError(error instanceof Error?error.message:"사용자 정보를 수정하지 못했습니다. 다시 시도해 주세요.")}};

  return <main className={styles.page}>
    <header className={styles.heading}><div><h1>사용자 관리</h1><p>운영 계정과 일반 사용자 정보를 조회하고 관리합니다.</p></div>{canWrite&&<Link className={styles.preparing} href="/admin/users/new"><span aria-hidden="true">＋</span> 운영 사용자 등록</Link>}</header>
    <nav className={styles.workViews} aria-label="사용자 범위" role="tablist" onKeyDown={event=>{if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;event.preventDefault();const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')),current=tabs.indexOf(document.activeElement as HTMLButtonElement),step=event.key==="ArrowRight"?1:-1,next=tabs[(current+step+tabs.length)%tabs.length];next?.focus();next?.click()}}>{workViews.map(view=>{const count=result?.summary[view==="all"?"total":view];return <button type="button" role="tab" key={view} aria-selected={query.view===view} tabIndex={query.view===view?0:-1} onClick={()=>updateQuery({view:view==="all"?null:view,issue:null,page:null,user:null})}>{viewLabels[view]} <b>{count??"—"}</b></button>})}</nav>
    {query.view==="attention"&&result&&<section className={styles.attentionFilters} aria-label="검토 필요 조건">{attentionFilters.map(item=><button type="button" key={item.key} aria-pressed={query.attentionReason===item.key} onClick={()=>updateQuery({issue:query.attentionReason===item.key?null:item.key,page:null,user:null})}>{item.label} <b>{item.count}</b></button>)}</section>}
    <section className={styles.toolbar} aria-label="사용자 검색 및 필터">
      <label className={styles.search}><span className={styles.searchLabel}>이름 또는 이메일 검색</span><input aria-label="이름 또는 이메일 검색" value={keyword} placeholder="이름 또는 이메일 검색" onChange={event=>setKeyword(event.target.value)} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={event=>{composing.current=false;setKeyword(event.currentTarget.value)}} onKeyDown={event=>{if(event.key==="Enter"&&!composing.current)updateQuery({keyword:keyword.trim()||null,page:null,user:null})}}/>{keyword&&<button type="button" onClick={()=>{setKeyword("");updateQuery({keyword:null,page:null,user:null})}} aria-label="검색어 지우기">×</button>}</label>
      <button ref={filterTrigger} type="button" className={styles.conditionTrigger} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(value=>!value)}>조건 설정{chips.filter(([key])=>key!=="keyword").length?` · ${chips.filter(([key])=>key!=="keyword").length}`:""}</button>
      {filtersOpen&&<><button type="button" className={styles.conditionBackdrop} aria-label="조건 설정 닫기" onClick={closeFilters}/><FilterInspector styles={styles} query={query} organizations={organizations} adapter={adapter} onClose={closeFilters} onApply={draft=>{updateQuery({role:draft.role,account_status:draft.accountStatus,organization_public_id:draft.organizationPublicId,organization_unassigned:draft.organizationUnassigned?"true":null,sort:draft.sort==="created_at,asc"?"created_at,asc":null,page:null,user:null});setFiltersOpen(false)}}/></>}
    </section>
    {chips.length>0&&<div className={styles.chips}><span>적용된 조건</span>{chips.map(([key,label])=><button type="button" key={key} onClick={()=>{if(key==="keyword")setKeyword("");updateQuery({[key]:null,page:null,user:null})}}>{label} ×</button>)}<button type="button" className={styles.reset} onClick={clearAll}>초기화</button></div>}

    <div className={`${styles.workspace}${selectedId?` ${styles.withInspector}`:""}${deactivationOpen?` ${styles.deactivationMode}`:""}`}>
      <section className={styles.listPanel} ref={listTop} aria-labelledby="user-list-title" aria-busy={listLoading}>
        <header><h2 id="user-list-title">사용자 목록</h2><span>{result?`검색 결과 ${result.pagination.totalElements}명`:"검색 중"}</span></header>
        <div className={styles.tableHead}><span>사용자</span><span>소속</span><span className={styles.roleHeading}>역할 <RoleLegendPopover/></span><span>{query.view==="inactive"?"비활성화 정보":"계정 상태"}</span><span>{query.view==="inactive"?"복구 상태":"최근 로그인"}</span></div>
        {listError?<div className={styles.state} role="alert"><strong>Mock 사용자 목록을 불러오지 못했습니다.</strong><button type="button" onClick={()=>void loadList()}>다시 시도</button></div>:!result?<div className={styles.skeleton}>{Array.from({length:8},(_,index)=><i key={index}/>)}</div>:result.items.length===0?<div className={styles.state}><strong>{query.view==="attention"&&!hasConditions?"현재 검토가 필요한 사용자가 없습니다.":hasConditions?"조건에 맞는 사용자가 없습니다.":"등록된 사용자가 없습니다."}</strong><p>{hasConditions?"검색어나 필터 조건을 변경해 주세요.":"운영 사용자를 등록하면 이곳에서 관리할 수 있습니다."}</p>{hasConditions?<button type="button" onClick={clearAll}>조건 초기화</button>:canWrite?<Link href="/admin/users/new">운영 사용자 등록</Link>:null}</div>:<div role="listbox" aria-label="사용자 선택" className={`${styles.rows}${listLoading?` ${styles.isUpdating}`:""}`}>{result.items.map(item=>{const selected=item.publicId===selectedId,checks=userChecks(item);return <button role="option" type="button" className={selected?styles.selected:undefined} aria-selected={selected} key={item.publicId} onClick={event=>choose(item,event.currentTarget)}><span className={styles.identity}><i aria-hidden="true">{item.userName.trim().charAt(0)}</i><span><strong title={item.userName}>{item.userName}</strong><small title={item.email}>{item.email}</small>{checks.length>0&&<small className={styles.reviewReason} title={checks.join(", ")}>{checks[0]}{checks.length>1?` +${checks.length-1}`:""}</small>}</span></span><span title={item.organization?.name}>{item.organization?.name??"소속 미지정"}</span><span className={styles.roleBadges}>{item.roles.length?<RoleBadgeGroup roles={item.roles} maxVisible={1}/>:<b className={styles.unassigned}>역할 미지정</b>}</span><span><em className={item.accountStatus==="ACTIVE"?styles.active:styles.inactive}>● {statusLabel[item.accountStatus]}</em></span><span title={item.lastLoginAt?`${formatKst(item.lastLoginAt)} KST`:"로그인 기록 없음"}>{item.lastLoginAt?formatKst(item.lastLoginAt):"기록 없음"}</span></button>})}</div>}
        {result&&<footer className={styles.directoryFooter}><span className={styles.rangeSummary}>{result.pagination.totalElements?`전체 ${result.pagination.totalElements}명 · ${(query.page-1)*query.size+1}–${Math.min(query.page*query.size,result.pagination.totalElements)}명 표시`:"전체 0명"}</span><nav className={styles.pagination} aria-label="사용자 목록 페이지"><button type="button" aria-label="이전 페이지" disabled={query.page<=1} onClick={()=>{updateQuery({page:String(query.page-1),user:null});listTop.current?.scrollIntoView({behavior:"smooth"})}}><PaginationChevron direction="left"/></button>{getUserPaginationItems(query.page,result.pagination.totalPages).map((item,index)=>item==="ellipsis"?<span className={styles.paginationEllipsis} aria-hidden="true" key={`ellipsis-${index}`}>…</span>:<button type="button" key={item} aria-label={`${item}페이지`} aria-current={query.page===item?"page":undefined} onClick={()=>{if(query.page===item)return;updateQuery({page:String(item),user:null});listTop.current?.scrollIntoView({behavior:"smooth"})}}>{item}</button>)}<button type="button" aria-label="다음 페이지" disabled={query.page>=result.pagination.totalPages} onClick={()=>{updateQuery({page:String(query.page+1),user:null});listTop.current?.scrollIntoView({behavior:"smooth"})}}><PaginationChevron direction="right"/></button></nav><UserPageSizeSelect value={query.size} onChange={value=>updateQuery({size:String(value),page:null,user:null})}/></footer>}
      </section>
      {selectedId&&<div className={`${styles.backdrop} ${styles.open}`} onClick={()=>{if(!deactivationOpen)closeInspector()}}/>}<aside ref={inspectorRef} className={`${styles.inspector}${selectedId?` ${styles.open}`:""}`} aria-label="선택 사용자 상세" onKeyDown={event=>{if(deactivationOpen||event.key!=="Tab"||!window.matchMedia("(max-width: 1199px)").matches)return;const focusable=inspectorRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]),[href],input,select");if(!focusable?.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}}>
        {deactivationOpen&&detail&&currentUser?.publicId?<AccountDeactivationFlow user={detail} actorPublicId={currentUser.publicId} adapter={adapter} onDirtyChange={setDeactivationDirty} onClose={()=>{setDeactivationOpen(false);setDeactivationDirty(false);requestAnimationFrame(()=>inspectorRef.current?.querySelector<HTMLButtonElement>(`.${styles.accountAccess} button`)?.focus())}} onMissing={()=>{setDeactivationOpen(false);setNotice("사용자를 찾을 수 없습니다.");updateQuery({user:null});void loadList()}} onSuccess={updated=>{setDeactivationDirty(false);setDeactivationOpen(false);setDetail(updated);setResult(current=>current?{...current,items:current.items.map(item=>item.publicId===updated.publicId?updated:item)}:current);setNotice(`${updated.userName} 계정이 비활성화되었습니다.`);void loadList()}}/>:!selectedId?<div className={styles.inspectorEmpty}><h2>사용자 상세</h2><i aria-hidden="true">♙</i><strong>사용자를 선택해 주세요.</strong><p>목록에서 사용자를 선택하면 기본 정보와 역할·권한 상태를 확인할 수 있습니다.</p></div>:detailLoading&&!detail?<div className={styles.detailSkeleton}><i/><i/><i/><i/></div>:detailMissing||!detail?<div className={styles.inspectorEmpty} role="alert"><h2>사용자 상세</h2><strong>사용자 정보를 찾을 수 없습니다.</strong><button type="button" onClick={closeInspector}>상세 닫기</button></div>:<><header className={styles.inspectorHead}><div>{inspectorMode==="view"&&<span className={detail.accountStatus==="ACTIVE"?styles.active:styles.inactive}>{statusLabel[detail.accountStatus]}</span>}<h2>{inspectorMode==="view"?detail.userName:"사용자 정보 수정"}</h2><p title={detail.email}>{detail.email}</p></div><div className={styles.inspectorHeadActions}>{canWrite&&detail.accountStatus==="ACTIVE"&&inspectorMode==="view"&&<button type="button" onClick={beginEdit}>정보 수정</button>}<button type="button" onClick={closeInspector} aria-label="사용자 상세 닫기">×</button></div></header>
          {inspectorMode!=="view"&&draft?<div className={styles.editBody}><div className={styles.editFields}><label htmlFor="edit-user-name"><span>사용자명 *</span><input id="edit-user-name" value={draft.userName} maxLength={100} aria-invalid={Boolean(editErrors.userName)} aria-describedby="edit-user-name-error" onChange={event=>setDraft({...draft,userName:event.target.value})}/><small id="edit-user-name-error" className={styles.fieldError}>{editErrors.userName??" "}</small></label><label htmlFor="edit-user-phone"><span>전화번호</span><input id="edit-user-phone" value={draft.phone} inputMode="numeric" maxLength={13} aria-invalid={Boolean(editErrors.phone)} aria-describedby="edit-user-phone-error" placeholder="010-0000-0000" onChange={event=>setDraft({...draft,phone:formatAdminPhone(event.target.value)})}/><small id="edit-user-phone-error" className={styles.fieldError}>{editErrors.phone??" "}</small></label><label htmlFor="edit-user-org"><span>소속 기관 *</span>{organizationsLoading?<span role="status">소속 기관을 불러오는 중입니다.</span>:organizationsError?<span className={styles.saveError} role="alert">소속 기관을 불러오지 못했습니다. <button type="button" onClick={()=>loadOrganizations(new AbortController())}>다시 시도</button></span>:organizations.length===0?<span className={styles.saveError} role="alert">선택할 수 있는 소속 기관이 없습니다.</span>:<div id="edit-user-org"><OrganizationExplorer organizations={organizations} value={draft.organizationPublicId?{type:"ORGANIZATION",publicId:draft.organizationPublicId}:{type:"ALL"}} onChange={value=>setDraft({...draft,organizationPublicId:value.type==="ORGANIZATION"?value.publicId:""})} label="소속 선택"/></div>}<small className={styles.fieldError}>{editErrors.organization??" "}</small></label></div><section className={styles.readOnlyInfo}><h3>수정할 수 없는 정보</h3><dl><div><dt>이메일</dt><dd>{detail.email}<small>이메일은 계정 식별 정보이므로 변경할 수 없습니다.</small></dd></div><div><dt>역할</dt><dd>{detail.roles.map(getRoleLabel).join(", ")||"역할 없음"}<small>역할은 역할 관리 기능에서 별도로 변경합니다.</small></dd></div><div><dt>계정 상태</dt><dd>{statusLabel[detail.accountStatus]}<small>계정 상태는 별도의 계정 관리 작업에서 변경합니다.</small></dd></div></dl></section><ChangeSummary styles={styles} user={detail} draft={draft} organizations={organizations}/>{saveError&&<p className={styles.saveError} role="alert">{saveError}</p>}<footer className={styles.editActions}><button type="button" disabled={inspectorMode==="saving"} onClick={cancelEdit}>취소</button><button type="button" className={styles.save} disabled={!editDirty||inspectorMode==="saving"||organizationsLoading||organizationsError} onClick={()=>void saveEdit()}>{inspectorMode==="saving"?"저장 중…":"변경사항 저장"}</button></footer></div>:<><div className={styles.tabs} role="tablist" aria-label="사용자 상세 정보">{([["basic","기본 정보"],["roles","역할·권한"],["changes","변경 이력"]] as const).map(([id,label])=><button type="button" role="tab" aria-selected={tab===id} key={id} onClick={()=>setTab(id)}>{label}</button>)}</div>
          <div className={styles.tabBody} role="tabpanel">
            {tab==="basic"&&<dl>{[["계정 상태",statusLabel[detail.accountStatus]],["사용자명",detail.userName],["이메일",detail.email],["전화번호",formatPhone(detail.phone)],["소속",detail.organization?.name??"소속 없음"],["등록일",`${formatKst(detail.createdAt)} KST`],["최근 수정",`${formatKst(detail.updatedAt)} KST`],["마지막 로그인",detail.lastLoginAt?`${formatKst(detail.lastLoginAt)} KST`:"로그인 기록 없음"]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
            {tab==="roles"&&<section className={styles.roleDetail}>{roleEditing?<InlineRoleEditor user={detail} styles={styles} adapter={adapter} onCancel={()=>setRoleEditing(false)} onSaved={updated=>{setDetail(updated);setResult(current=>current?{...current,items:current.items.map(item=>item.publicId===updated.publicId?updated:item)}:current);setRoleEditing(false);setNotice(`${updated.userName} 사용자의 역할이 변경되었습니다.`);void loadList()}}/>:<><h3>현재 역할 및 접근 범위</h3><RoleDescription roles={detail.roles} showCodes/>{canManageRoles&&detail.accountStatus==="ACTIVE"&&<button type="button" className={styles.secondaryAction} onClick={()=>setRoleEditing(true)}>역할 변경</button>}</>}</section>}
            {tab==="changes"&&<section className={styles.changeDetail}>{detail.changes.length===0?<p>변경 이력 기록이 없습니다.</p>:<ol>{detail.changes.map(change=><li key={change.id}><strong>{change.action}</strong><span>{change.summary}</span><small>{change.actor} · {formatKst(change.occurredAt)} KST</small></li>)}</ol>}</section>}
          </div>
          {query.view==="inactive"&&detail.accountStatus==="INACTIVE"?<AccountActivationReview user={detail} adapter={adapter} styles={styles} onClose={closeInspector} onSuccess={updated=>{setNotice(`${updated.userName} 계정이 활성화되었습니다. 비활성 계정 목록에서 제외되었습니다.`);setDetail(null);updateQuery({user:null});void loadList()}}/>:<><section className={styles.accountAccess}><h3>계정 접근 관리</h3><p><b>현재 상태 · {statusLabel[detail.accountStatus]}</b></p>{detail.accountStatus==="ACTIVE"?<><p>계정을 비활성화하면 신규 로그인이 차단되고 현재 활성 세션이 종료됩니다. 사용자 계정과 기존 업무 이력은 삭제되지 않습니다.</p>{canWrite&&<button type="button" disabled={currentUser?.publicId===detail.publicId} onClick={()=>{setDeactivationDirty(false);setDeactivationOpen(true)}}>계정 비활성화 검토</button>}{currentUser?.publicId===detail.publicId&&<small>본인의 계정은 직접 비활성화할 수 없습니다.</small>}</>:<><p>이 계정은 현재 로그인할 수 없습니다. 기존 사건·출동·감사 이력은 그대로 유지됩니다.</p>{detail.deactivatedAt&&<small>비활성화 시각 · {formatKst(detail.deactivatedAt)} KST</small>}</>}</section><footer className={styles.inspectorActions}><Link href={`/admin/users/${detail.publicId}`}>전체 상세 열기</Link></footer></>}</>}
        </>}
      </aside>
    </div>
    {notice&&<div className={styles.toast} role="status" onAnimationEnd={()=>setNotice("")}>{notice}</div>}
  </main>;
}

type FilterDraft={role:UserRole|null;accountStatus:AccountStatus|null;organizationPublicId:string|null;organizationUnassigned:boolean;sort:UserListQuery["sort"]};
function FilterInspector({styles,query,organizations,adapter,onClose,onApply}:{styles:Styles;query:UserListQuery;organizations:OrganizationOption[];adapter:ReturnType<typeof createUserManagementAdapter>;onClose:()=>void;onApply:(draft:FilterDraft)=>void}){
 const panel=useRef<HTMLElement|null>(null);
 const initial:FilterDraft={role:query.role,accountStatus:query.accountStatus,organizationPublicId:query.organizationPublicId,organizationUnassigned:query.organizationUnassigned,sort:query.sort};
 const[draft,setDraft]=useState(initial),[count,setCount]=useState<number|null>(null);
 useEffect(()=>{const controller=new AbortController();setCount(null);void adapter.listUsers({...query,...draft,page:1,size:10},controller.signal).then(result=>setCount(result.pagination.totalElements)).catch(()=>setCount(null));return()=>controller.abort()},[adapter,draft,query]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key)},[onClose]);
 useEffect(()=>{requestAnimationFrame(()=>panel.current?.querySelector<HTMLElement>("button,input")?.focus())},[]);
 const organizationValue:OrganizationExplorerValue=draft.organizationUnassigned?{type:"UNASSIGNED"}:draft.organizationPublicId?{type:"ORGANIZATION",publicId:draft.organizationPublicId}:{type:"ALL"};
 const reset=()=>setDraft({role:null,accountStatus:null,organizationPublicId:null,organizationUnassigned:false,sort:"created_at,desc"});
 return <section ref={panel} className={styles.conditionPanel} role="dialog" aria-modal="false" aria-labelledby="condition-title" onKeyDown={event=>{if(event.key!=="Tab")return;const items=panel.current?.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled])");if(!items?.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}}>
  <header><div><h2 id="condition-title">조건 설정</h2><p>{count===null?"결과 확인 중…":`현재 선택한 조건으로 ${count}명의 사용자가 표시됩니다.`}</p></div><button type="button" aria-label="조건 설정 닫기" onClick={onClose}>×</button></header>
  <div className={styles.conditionBody}>
   <fieldset><legend>역할</legend>{ROLE_ORDER.map(role=>{const presentation=ROLE_PRESENTATIONS[role];return <label className={styles.conditionRole} key={role} style={{"--filter-accent":presentation.color.accent,"--filter-surface":presentation.color.background,"--filter-border":presentation.color.border} as React.CSSProperties}><input type="radio" name="role-filter" checked={draft.role===role} onChange={()=>setDraft({...draft,role:draft.role===role?null:role})}/><i className={styles.conditionRoleSymbol} aria-hidden="true">{ROLE_SYMBOLS[role]}</i><span><strong>{presentation.label}</strong><small>{presentation.shortDescription}</small></span></label>})}</fieldset>
   <fieldset><legend>계정 상태</legend><div className={styles.conditionSegments}>{([["","전체"],["ACTIVE","활성"],["INACTIVE","비활성"]] as const).map(([value,label])=><button type="button" aria-pressed={(draft.accountStatus??"")===value} key={value} onClick={()=>setDraft({...draft,accountStatus:value||null})}>{label}</button>)}</div></fieldset>
   {organizations.length>0&&<fieldset><legend>소속</legend><OrganizationExplorer organizations={organizations} value={organizationValue} onChange={value=>setDraft({...draft,organizationPublicId:value.type==="ORGANIZATION"?value.publicId:null,organizationUnassigned:value.type==="UNASSIGNED"})} allowAll allowUnassigned label="소속 선택"/></fieldset>}
   <fieldset><legend>정렬</legend>{([["created_at,desc","최근 등록순"],["created_at,asc","오래된 등록순"]] as const).map(([value,label])=><label className={styles.sortOption} key={value}><input type="radio" name="user-sort" checked={draft.sort===value} onChange={()=>setDraft({...draft,sort:value})}/>{label}</label>)}</fieldset>
  </div>
  <footer><button type="button" onClick={reset}>조건 초기화</button><button type="button" disabled={count===null} onClick={()=>onApply(draft)}>{count===null?"결과 확인 중…":`${count}명 보기`}</button></footer>
 </section>
}

function InlineRoleEditor({user,styles,adapter,onCancel,onSaved}:{user:ManagedUser;styles:Styles;adapter:ReturnType<typeof createUserManagementAdapter>;onCancel:()=>void;onSaved:(user:ManagedUser)=>void}){
 const[roles,setRoles]=useState<UserRole[]>(user.roles),[reason,setReason]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const normalized=sortRoles(roles),before=sortRoles(user.roles),changed=normalized.join("|")!==before.join("|");
 const toggle=(role:UserRole)=>setRoles(current=>current.includes(role)?current.filter(item=>item!==role):sortRoles([...current,role]));
 const save=async()=>{if(!changed||!roles.length||!reason.trim()||saving)return;setSaving(true);setError("");try{onSaved(await adapter.updateUserRoles(user.publicId,{roles:normalized,reason:reason.trim()}))}catch(caught){setError(caught instanceof Error?caught.message:"역할을 변경하지 못했습니다.")}finally{setSaving(false)}};
 return <div className={styles.inlineRoleEditor} aria-busy={saving}>
  <header><h3>역할 변경</h3><p>사용자에게 부여할 전체 역할을 선택합니다.</p></header>
  <section className={styles.roleComparison}><div><span>현재 역할</span><RoleBadgeGroup roles={user.roles}/></div><div><span>변경 후</span><RoleBadgeGroup roles={roles}/></div></section>
  <fieldset><legend>역할 선택</legend>{ROLE_ORDER.map(role=>{const presentation=ROLE_PRESENTATIONS[role],checked=roles.includes(role);return <label key={role} style={{"--option-accent":presentation.color.accent,"--option-surface":presentation.color.background,"--option-border":presentation.color.border} as React.CSSProperties}><input type="checkbox" checked={checked} onChange={()=>toggle(role)}/><span><strong><i aria-hidden="true"/>{presentation.label}</strong><small>{presentation.shortDescription}</small></span></label>})}</fieldset>
  {!roles.length&&<p className={styles.fieldError} role="alert">최소 한 개 이상의 역할을 선택해 주세요.</p>}
  <label className={styles.roleReason}><span>변경 사유 *</span><textarea value={reason} maxLength={500} onChange={event=>setReason(event.target.value)} placeholder="역할 변경 사유를 입력해 주세요."/><small>{reason.length} / 500자</small></label>
  <p className={styles.roleSessionNotice}>역할이 변경되면 대상 사용자의 현재 세션이 종료되며 다시 로그인해야 합니다.</p>
  {error&&<p className={styles.saveError} role="alert">{error}</p>}
  <footer><button type="button" disabled={saving} onClick={onCancel}>변경 취소</button><button type="button" className={styles.save} disabled={!changed||!roles.length||!reason.trim()||saving} onClick={()=>void save()}>{saving?"저장 중…":"역할 변경 저장"}</button></footer>
 </div>
}

function ChangeSummary({styles,user,draft,organizations}:{styles:Styles;user:ManagedUser;draft:EditDraft;organizations:OrganizationOption[]}){
 const patch=buildUserUpdatePatch(user,draft),rows:string[][]=[];
 if(patch.userName!==undefined)rows.push(["사용자명",user.userName,patch.userName]);
 if(patch.phone!==undefined)rows.push(["전화번호",formatPhone(user.phone),patch.phone?formatAdminPhone(patch.phone):"등록되지 않음"]);
 if(patch.organizationPublicId!==undefined)rows.push(["소속 기관",user.organization?.name??"소속 없음",organizations.find(item=>item.publicId===patch.organizationPublicId)?.name??"선택한 조직"]);
 return <section className={styles.changeSummary}><h3>변경사항 {rows.length?`${rows.length}개`:""}</h3>{rows.length?<dl>{rows.map(([label,before,after])=><div key={label}><dt>{label}</dt><dd><span>{before}</span><i aria-hidden="true">→</i><strong>{after}</strong></dd></div>)}</dl>:<p>아직 변경된 정보가 없습니다.</p>}</section>
}
