"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import type { UserRole } from "@/types/auth";
import { createUserManagementAdapter } from "./mockUserManagementAdapter";
import { ROLE_ORDER, ROLE_PRESENTATIONS, sortRoles } from "./rolePresentationConfig";
import { RoleIcon, type RoleIconKind } from "./RoleIcon";
import { AdminFilterSelect } from "./AdminFilterSelect";
import { listAllManagedUsers } from "./listAllManagedUsers";
import { OrganizationExplorer, type OrganizationExplorerValue } from "./OrganizationExplorer";
import { PaginationChevron, UserPageSizeSelect } from "./UserDirectoryPagination";
import { compareRoles, hasRoleChanges, validateRoleDraft } from "./roleManagementDomain";
import type { AccountStatus, ManagedUser, OrganizationOption } from "./userManagementTypes";
import styles from "./RoleManagementWorkspace.module.css";

type View = "all" | "unassigned" | "multiple" | "system-admin";
type Tab = "assignment" | "matrix";
const validViews = new Set<View>(["all", "unassigned", "multiple", "system-admin"]);
const validRoles = new Set<UserRole>(ROLE_ORDER);
const statusLabel: Record<AccountStatus, string> = { ACTIVE: "활성", INACTIVE: "비활성" };
const summaryMeta: { key: View; label: string; icon: RoleIconKind }[] = [
  { key: "all", label: "전체 사용자", icon: "ALL" },
  { key: "unassigned", label: "역할 미지정", icon: "UNASSIGNED" },
  { key: "multiple", label: "복수 역할", icon: "MULTIPLE" },
  { key: "system-admin", label: "시스템 관리자", icon: "SYSTEM_ADMIN" },
];
const formatDate = (value: string | null) => {
  if (!value) return "기록 없음";
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part("year")}.${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`;
};
const ResetIcon=()=> <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 17 6-6 8 8-2 2H7l-4-4Zm8-8 5-5 5 5-5 5"/></svg>;
const SettingsIcon=()=> <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></svg>;
const FilterIcon=({kind}:{kind:"search"|"status"|"roles"|"assign"|"matrix"})=><svg viewBox="0 0 24 24" aria-hidden="true">{kind==="search"?<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>:kind==="status"?<><circle cx="9" cy="8" r="4"/><path d="M3 21a6 6 0 0 1 12 0m2-9 2 2 3-4"/></>:kind==="roles"?<><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20a6 6 0 0 1 12 0m1-5a5 5 0 0 1 7 5"/></>:kind==="assign"?<><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m4-12v6m-3-3h6"/></>:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>}</svg>;
const paginationItems=(total:number,current:number):(number|string)[]=>{
  if(total<=5)return Array.from({length:total},(_,index)=>index+1);
  const pages=new Set([1,total,current-1,current,current+1].filter(page=>page>=1&&page<=total));
  const ordered=[...pages].sort((a,b)=>a-b),result:(number|string)[]=[];
  ordered.forEach((page,index)=>{if(index&&page-ordered[index-1]>1)result.push(`ellipsis-${page}`);result.push(page)});
  return result;
};

function RoleChip({ role }: { role: UserRole }) {
  const meta = ROLE_PRESENTATIONS[role];
  return <span className={styles.roleChip} style={{ "--accent": meta.color.accent, "--surface": meta.color.background, "--border": meta.color.border } as React.CSSProperties}><RoleIcon kind={role}/>{meta.label}</span>;
}

function RoleChipGroup({ roles }: { roles: UserRole[] }) {
  if (!roles.length) return <span className={`${styles.roleChip} ${styles.unassignedChip}`}><RoleIcon kind="UNASSIGNED"/>역할 미지정</span>;
  const ordered = sortRoles(roles);
  return <div className={styles.roleChips}>{ordered.slice(0, 2).map(role => <RoleChip key={role} role={role}/>)}{ordered.length > 2 && <button type="button" className={styles.moreRoles} aria-label={`추가 역할 ${ordered.length - 2}개`}><span>+{ordered.length - 2}</span><span role="tooltip">{ordered.map(role => ROLE_PRESENTATIONS[role].label).join(", ")}</span></button>}</div>;
}

export function RoleManagementWorkspace() {
  const adapter = useMemo(() => createUserManagementAdapter(), []);
  const params = useSearchParams(), pathname = usePathname(), router = useRouter(), { user: actor } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]), [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [draft, setDraft] = useState<UserRole[]>([]);
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(""), [discardOpen, setDiscardOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false), [notice, setNotice] = useState("");
  const [viewSettingsOpen,setViewSettingsOpen]=useState(false),[compactRows,setCompactRows]=useState(false),[pinColumns,setPinColumns]=useState(true);
  const drawerRef = useRef<HTMLElement | null>(null), dialogRef = useRef<HTMLElement | null>(null), listRef = useRef<HTMLElement | null>(null), selectedTrigger = useRef<HTMLElement | null>(null);
  const viewSettingsRef=useRef<HTMLDivElement|null>(null);
  const rawRole = params.get("role"), roleFilter = rawRole && validRoles.has(rawRole as UserRole) ? rawRole as UserRole : null;
  const rawView = params.get("view"), view = rawView && validViews.has(rawView as View) ? rawView as View : "all";
  const tab: Tab = params.get("tab") === "matrix" ? "matrix" : "assignment";
  const status = params.get("account_status") === "ACTIVE" || params.get("account_status") === "INACTIVE" ? params.get("account_status") as AccountStatus : null;
  const keyword = (params.get("keyword") ?? "").trim(), organizationId = params.get("organization_public_id"), organizationUnassigned = params.get("organization_unassigned") === "true", selectedId = params.get("user");
  const size = [10, 20, 50].includes(Number(params.get("size"))) ? Number(params.get("size")) : 10, page = Math.max(1, Number(params.get("page")) || 1);
  const update = useCallback((values: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(values).forEach(([key, value]) => value && !(key === "page" && value === "1") && !(key === "size" && value === "10") && !(key === "tab" && value === "assignment") ? next.set(key, value) : next.delete(key));
    const url = `${pathname}${next.size ? `?${next}` : ""}`;
    if (push) router.push(url, { scroll: false }); else router.replace(url, { scroll: false });
  }, [params, pathname, router]);
  const load = useCallback(async (signal: AbortSignal = new AbortController().signal) => {
    setLoading(true); setError("");
    try { const [result, orgs] = await Promise.all([listAllManagedUsers(adapter, signal), adapter.listOrganizations(signal)]); setUsers(result); setOrganizations(orgs); }
    catch (caught) { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError("역할 배정 정보를 불러오지 못했습니다."); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [adapter]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  const filtered = useMemo(() => users.filter(user => {
    const needle = keyword.toLocaleLowerCase("ko-KR");
    return (!needle || user.userName.toLocaleLowerCase("ko-KR").includes(needle) || user.email.toLowerCase().includes(needle))
      && (!organizationId || user.organization?.publicId === organizationId) && (!organizationUnassigned || !user.organization)
      && (!status || user.accountStatus === status) && (!roleFilter || user.roles.includes(roleFilter))
      && (view === "all" || view === "unassigned" && !user.roles.length || view === "multiple" && user.roles.length > 1 || view === "system-admin" && user.roles.includes("SYSTEM_ADMIN") && user.accountStatus === "ACTIVE");
  }), [keyword, organizationId, organizationUnassigned, roleFilter, status, users, view]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size)), safePage = Math.min(page, totalPages), visible = filtered.slice((safePage - 1) * size, safePage * size);
  const selected = users.find(user => user.publicId === selectedId) ?? null;
  const activeAdmins = users.filter(user => user.accountStatus === "ACTIVE" && user.roles.includes("SYSTEM_ADMIN")).length;
  const summary: Record<View, number> = { all: users.length, unassigned: users.filter(user => !user.roles.length).length, multiple: users.filter(user => user.roles.length > 1).length, "system-admin": activeAdmins };
  const roleCounts = Object.fromEntries(ROLE_ORDER.map(role => [role, filtered.filter(user => user.roles.includes(role)).length])) as Record<UserRole, number>;
  const change = selected ? compareRoles(selected.roles, draft) : null, dirty = Boolean(change && hasRoleChanges(change)), block = selected ? validateRoleDraft(selected, draft, activeAdmins) : null;
  const filtersChanged = Boolean(keyword || organizationId || organizationUnassigned || status || roleFilter || view !== "all");
  const organizationValue: OrganizationExplorerValue = organizationUnassigned ? { type: "UNASSIGNED" } : organizationId ? { type: "ORGANIZATION", publicId: organizationId } : { type: "ALL" };
  useEffect(() => { if (page > totalPages) update({ page: String(totalPages), user: null }); }, [page, totalPages, update]);
  useEffect(() => { if (!loading && selectedId && !selected) { setNotice("선택한 사용자를 찾을 수 없습니다."); update({ user: null }); } }, [loading, selected, selectedId, update]);
  useEffect(() => { setDraft(selected ? sortRoles(selected.roles) : []); setSaveError(""); setDiscardOpen(false); setConfirmOpen(false); }, [selected]);
  useEffect(() => { if (selected) requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>("button,input")?.focus()); }, [selected]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 3000); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(()=>{if(!viewSettingsOpen)return;const close=(event:PointerEvent)=>{if(!viewSettingsRef.current?.contains(event.target as Node))setViewSettingsOpen(false)};const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setViewSettingsOpen(false)};document.addEventListener("pointerdown",close);document.addEventListener("keydown",key);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",key)}},[viewSettingsOpen]);

  const closeDrawer = () => { update({ user: null }); requestAnimationFrame(() => selectedTrigger.current?.focus()); };
  const requestClose = () => { if (dirty) setDiscardOpen(true); else closeDrawer(); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { if (confirmOpen) setConfirmOpen(false); else if (discardOpen) setDiscardOpen(false); else if (selected) requestClose(); } };
    document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key);
  });
  const choose = (user: ManagedUser, target: HTMLElement) => { selectedTrigger.current = target; update({ user: user.publicId, tab: "assignment" }, true); };
  const toggle = (role: UserRole) => setDraft(current => current.includes(role) ? current.filter(item => item !== role) : sortRoles([...current, role]));
  const applySave = async () => {
    if (!selected || !dirty || block || saving) return;
    setSaving(true); setSaveError("");
    try {
      const updated = await adapter.updateUserRoles(selected.publicId, { roles: sortRoles(draft), reason: "시스템 관리자 역할 배정 변경" });
      setUsers(current => current.map(user => user.publicId === updated.publicId ? updated : user));
      setConfirmOpen(false); setNotice(`${updated.userName} 사용자의 역할이 변경되었습니다.`); closeDrawer();
    } catch (caught) { setSaveError(caught instanceof Error ? caught.message : "역할을 변경하지 못했습니다."); setConfirmOpen(false); }
    finally { setSaving(false); }
  };
  const clear = () => update({ keyword: null, organization_public_id: null, organization_unassigned: null, account_status: null, role: null, view: null, page: null, user: null });
  const trap = (event: React.KeyboardEvent<HTMLElement>, root: HTMLElement | null) => {
    if (event.key !== "Tab") return;
    const nodes = root?.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])");
    if (!nodes?.length) return; const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (!actor?.apiPermissions.includes("ROLE.MANAGE")) return <main className={styles.state} role="alert"><strong>역할 관리 접근 권한이 없습니다.</strong></main>;
  return <main className={styles.page}>
    <header className={styles.heading}><h1>역할 관리</h1><p>사용자의 역할과 서비스 접근 범위를 관리합니다.</p></header>
    <div className={styles.tabs} role="tablist" aria-label="역할 관리 화면"><button type="button" role="tab" aria-selected={tab === "assignment"} onClick={() => update({ tab: null, page: null })}><FilterIcon kind="assign"/>역할 배정</button><button type="button" role="tab" aria-selected={tab === "matrix"} onClick={() => update({ tab: "matrix", user: null, page: null })}><FilterIcon kind="matrix"/>배정 현황</button></div>
    <nav className={styles.summaryFilters} aria-label="역할 사용자 요약 필터">{summaryMeta.map(item => <button type="button" aria-pressed={view === item.key} key={item.key} onClick={() => update({ view: item.key === "all" ? null : item.key, page: null, user: null })}><i data-kind={item.icon}><RoleIcon kind={item.icon}/></i><span>{item.label}</span><b>{summary[item.key]}</b></button>)}</nav>
    <section className={styles.filters} aria-label="역할 사용자 검색 및 필터">
      <label className={styles.searchField}><FilterIcon kind="search"/><span className={styles.srOnly}>이름 또는 이메일 검색</span><input aria-label="이름 또는 이메일 검색" placeholder="이름 또는 이메일 검색" value={keyword} onChange={event => update({ keyword: event.target.value.trim() || null, page: null, user: null })}/></label>
      <OrganizationExplorer organizations={organizations} value={organizationValue} allowAll allowUnassigned label="소속" loading={loading} onChange={value => update({ organization_public_id: value.type === "ORGANIZATION" ? value.publicId : null, organization_unassigned: value.type === "UNASSIGNED" ? "true" : null, page: null, user: null })}/>
      <AdminFilterSelect label="계정 상태" triggerIcon={<FilterIcon kind="status"/>} value={status ?? ""} options={[{ value: "", label: "전체",icon:<span className={styles.statusDot}/> }, { value: "ACTIVE", label: "활성",icon:<span className={styles.statusDot} data-status="ACTIVE"/> }, { value: "INACTIVE", label: "비활성",icon:<span className={styles.statusDot} data-status="INACTIVE"/> }]} onChange={value => update({ account_status: value || null, page: null, user: null })}/>
      <AdminFilterSelect label="역할" triggerIcon={<FilterIcon kind="roles"/>} value={roleFilter ?? ""} options={[{ value: "", label: "전체 역할",icon:<RoleIcon kind="ALL"/>,accent:"#53666F",surface:"#EEF2F2",border:"#D8E1E3",count:users.length }, ...ROLE_ORDER.map(role => ({ value: role, label: ROLE_PRESENTATIONS[role].label, icon: <RoleIcon kind={role}/>, accent: ROLE_PRESENTATIONS[role].color.accent,surface:ROLE_PRESENTATIONS[role].color.background,border:ROLE_PRESENTATIONS[role].color.border,count:users.filter(user=>user.roles.includes(role)).length }))]} onChange={value => update({ role: value || null, page: null, user: null })}/>
      <button type="button" className={styles.reset} disabled={!filtersChanged} onClick={clear}><ResetIcon/>필터 초기화</button>
    </section>
    {error && <section className={styles.error} role="alert"><strong>{error}</strong><button type="button" onClick={() => void load()}>다시 시도</button></section>}

    <section ref={listRef} className={styles.directory} aria-busy={loading}>
      <header><div><h2>{tab === "assignment" ? "사용자 역할 배정" : "사용자별 역할 배정 현황"}</h2>{tab==="matrix"&&<p>각 사용자에게 부여된 역할과 서비스 접근 범위를 확인합니다.</p>}</div><div className={styles.directoryActions}><span>{filtersChanged?`검색 결과 ${filtered.length}명`:`전체 ${filtered.length}명`}</span>{tab==="matrix"&&<div ref={viewSettingsRef} className={styles.viewSettings}><button type="button" aria-expanded={viewSettingsOpen} aria-haspopup="dialog" onClick={()=>setViewSettingsOpen(open=>!open)}><SettingsIcon/>보기 설정</button>{viewSettingsOpen&&<section role="dialog" aria-label="보기 설정"><h3>보기 설정</h3><fieldset><legend>한 페이지에 표시</legend><div>{[10,20,50].map(value=><button type="button" aria-pressed={size===value} key={value} onClick={()=>update({size:String(value),page:null,user:null})}>{value}명</button>)}</div></fieldset><fieldset><legend>행 간격</legend><div><button type="button" aria-pressed={!compactRows} onClick={()=>setCompactRows(false)}>기본</button><button type="button" aria-pressed={compactRows} onClick={()=>setCompactRows(true)}>좁게</button></div></fieldset><label><input type="checkbox" checked={pinColumns} onChange={event=>setPinColumns(event.target.checked)}/>사용자·소속 열 고정</label></section>}</div>}</div></header>
      {loading ? <div className={styles.skeleton}>{Array.from({ length: 7 }, (_, index) => <i key={index}/>)}</div> : !visible.length ? <div className={styles.empty}><strong>조건에 맞는 사용자가 없습니다.</strong><button type="button" onClick={clear}>초기화</button></div> : tab === "assignment" ? <div className={styles.tableScroll}><table className={styles.userTable}><thead><tr><th>사용자</th><th>소속</th><th>현재 역할</th><th>계정 상태</th><th>최근 로그인</th><th>관리</th></tr></thead><tbody>{visible.map(user => <tr className={selectedId===user.publicId?styles.selectedRow:undefined} key={user.publicId}><td><button type="button" className={styles.userButton} onClick={event => choose(user, event.currentTarget)}><span className={styles.avatar}>{user.userName.charAt(0)}</span><span><strong>{user.userName}</strong><small>{user.email}</small></span></button></td><td>{user.organization?.name ?? "소속 없음"}</td><td><RoleChipGroup roles={user.roles}/></td><td><span className={styles.accountStatus} data-status={user.accountStatus}><i/>{statusLabel[user.accountStatus]}</span></td><td>{formatDate(user.lastLoginAt)}</td><td><button type="button" className={styles.manageButton} aria-label={`${user.userName} 역할 설정`} onClick={event => choose(user, event.currentTarget)}><FilterIcon kind="assign"/>역할 설정</button></td></tr>)}</tbody></table></div> : <div className={`${styles.tableScroll} ${pinColumns?styles.pinnedColumns:""}`} data-density={compactRows?"compact":"default"}><table className={styles.matrixTable}><thead><tr><th>사용자</th><th>소속</th>{ROLE_ORDER.map(role => { const meta = ROLE_PRESENTATIONS[role]; return <th key={role} style={{ "--role-accent": meta.color.accent, "--role-surface": meta.color.background, "--role-border":meta.color.border } as React.CSSProperties}><RoleIcon kind={role}/><strong>{meta.label}</strong><small>{roleCounts[role]}명</small></th>; })}</tr></thead><tbody>{visible.map(user => <tr key={user.publicId}><th scope="row"><span className={styles.avatar}>{user.userName.charAt(0)}</span><span><strong title={user.userName} tabIndex={0}>{user.userName}</strong><small title={user.email} tabIndex={0}>{user.email}</small></span></th><td><span className={styles.organizationName} title={user.organization?.name ?? "소속 없음"} tabIndex={0}>{user.organization?.name ?? "소속 없음"}</span></td>{ROLE_ORDER.map(role => {const meta=ROLE_PRESENTATIONS[role],assigned=user.roles.includes(role);return <td key={role} aria-label={`${meta.label} ${assigned ? "배정됨" : "미배정"}`}>{assigned ? <span className={styles.assigned} style={{"--role-accent":meta.color.foreground,"--role-surface":meta.color.background,"--role-border":meta.color.border} as React.CSSProperties}><b aria-hidden="true">✓</b>배정됨</span> : <span className={styles.notAssigned}>—</span>}</td>})}</tr>)}</tbody></table></div>}
      {!loading && <footer className={styles.pagination}><span>{filtered.length?`전체 ${filtered.length}명 · ${(safePage-1)*size+1}–${Math.min(safePage*size,filtered.length)}명 표시`:`전체 0명`}</span><nav aria-label="사용자 페이지"><button type="button" aria-label="이전 페이지" disabled={safePage <= 1} onClick={() => update({ page: String(safePage - 1), user: null })}><PaginationChevron direction="left"/></button>{paginationItems(totalPages,safePage).map(item=>typeof item==="number"?<button type="button" aria-label={item===safePage?`현재 페이지 ${item}`:`${item}페이지`} key={item} aria-current={item === safePage ? "page" : undefined} onClick={() => update({ page: String(item), user: null })}>{item}</button>:<span className={styles.ellipsis} aria-hidden="true" key={item}>…</span>)}<button type="button" aria-label="다음 페이지" disabled={safePage >= totalPages} onClick={() => update({ page: String(safePage + 1), user: null })}><PaginationChevron direction="right"/></button></nav><UserPageSizeSelect value={size} onChange={value=>update({size:String(value),page:null,user:null})}/></footer>}
    </section>

    {selected && <><button type="button" className={styles.drawerBackdrop} aria-label="역할 설정 닫기" onClick={requestClose}/><aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="drawer-title" onKeyDown={event => trap(event, drawerRef.current)}><header><div><p>사용자 역할 설정</p><h2 id="drawer-title">역할 관리</h2></div><button type="button" aria-label="역할 설정 닫기" onClick={requestClose}>×</button></header><div className={styles.drawerBody}><section className={styles.userSummary}><span className={styles.avatar}>{selected.userName.charAt(0)}</span><div><h3>{selected.userName}</h3><p>{selected.email}</p><small>{selected.organization?.name ?? "소속 없음"} · {statusLabel[selected.accountStatus]}</small></div></section><section><h3>현재 역할</h3><RoleChipGroup roles={selected.roles}/></section><fieldset className={styles.roleOptions}><legend>변경할 역할</legend>{ROLE_ORDER.map(role => { const meta = ROLE_PRESENTATIONS[role], checked = draft.includes(role); return <label key={role} style={{ "--accent": meta.color.accent, "--surface": meta.color.background, "--border": meta.color.border } as React.CSSProperties}><input type="checkbox" checked={checked} onChange={() => toggle(role)}/><i><RoleIcon kind={role}/></i><span><strong>{meta.label}</strong><small>{meta.shortDescription}</small></span><b aria-hidden="true">{checked ? "✓" : ""}</b></label>; })}</fieldset>{block && <p className={styles.saveError} role="alert">현재 역할 구성은 저장할 수 없습니다. 역할 정책과 진행 중 업무를 확인해 주세요.</p>}{saveError && <p className={styles.saveError} role="alert">{saveError}</p>}</div><footer><button type="button" onClick={requestClose}>취소</button><button type="button" disabled={!dirty || Boolean(block) || saving || !draft.length} onClick={() => setConfirmOpen(true)}>역할 저장</button></footer></aside></>}
    {confirmOpen && selected && change && <div className={styles.confirmBackdrop} onMouseDown={event => event.target === event.currentTarget && setConfirmOpen(false)}><section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onKeyDown={event => trap(event, dialogRef.current)}><h2 id="confirm-title">역할을 변경하시겠습니까?</h2><p><strong>{selected.userName}</strong><br/>{selected.email}</p><dl><div><dt>기존 역할</dt><dd><RoleChipGroup roles={selected.roles}/></dd></div><div><dt>변경 역할</dt><dd><RoleChipGroup roles={draft}/></dd></div><div><dt>추가</dt><dd>{change.added.length ? change.added.map(role => <RoleChip key={role} role={role}/>) : "없음"}</dd></div><div><dt>해제</dt><dd>{change.removed.length ? change.removed.map(role => <RoleChip key={role} role={role}/>) : "없음"}</dd></div></dl><p className={styles.sessionNotice}>역할 변경 후 해당 사용자의 기존 로그인 세션이 종료될 수 있습니다.</p><footer><button type="button" autoFocus disabled={saving} onClick={() => setConfirmOpen(false)}>취소</button><button type="button" disabled={saving} onClick={() => void applySave()}>{saving ? "적용 중…" : "변경 적용"}</button></footer></section></div>}
    {discardOpen && <div className={styles.confirmBackdrop}><section role="alertdialog" aria-modal="true"><h2>변경 사항을 버리시겠습니까?</h2><p>저장하지 않은 역할 변경 내용이 사라집니다.</p><footer><button type="button" autoFocus onClick={() => setDiscardOpen(false)}>계속 편집</button><button type="button" onClick={() => { setDraft(sortRoles(selected?.roles ?? [])); setDiscardOpen(false); closeDrawer(); }}>버리고 닫기</button></footer></section></div>}
    {notice && <div className={styles.toast} role="status">{notice}</div>}
  </main>;
}
