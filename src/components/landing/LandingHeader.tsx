"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { SystemHealthPanel } from "./SystemHealthPanel";
import { getActiveSidebarMenuId, getAuthenticatedSidebarMenus, getLandingSidebarMenus, type SidebarIconName, type SidebarMenuItem } from "./sidebarMenuConfig";
import type { UserRole } from "@/types/auth";
import { NotificationPopover } from "@/features/notifications/NotificationPopover";
import "./landing.css";
import "./sidebarUnified.css";

const MenuIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const ServerIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></svg>;
const RailIcon = ({ type }: { type: SidebarIconName }) => {
  const paths = {
    home: <path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4Z" />,
    flow: <><circle cx="5" cy="12" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 12h4a4 4 0 0 0 4-4M11 12a4 4 0 0 1 4 4" /></>,
    login: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="m14 8 4 4-4 4M18 12H8"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    cctv: <><path d="m4 7 13-3 2 8-13 3z"/><path d="m8 14-2 6m9-8 4 5M4 20h8"/><circle cx="15.5" cy="7.5" r="1.4"/></>,
    monitor: <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4M8 9l2.5 2.5L16 7"/></>,
    incidents: <><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    dispatch: <><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
    admin: <><circle cx="12" cy="12" r="3"/><path d="M19 15.5 21 17l-4 4-1.5-2a8 8 0 0 1-3.5 1L11 22H7v-2a8 8 0 0 1-2.5-1L3 20l-3-3 2-1.5A8 8 0 0 1 1 12L0 11V7h2a8 8 0 0 1 1-2.5L2 3l3-3 1.5 2A8 8 0 0 1 10 1l1-1h4v2a8 8 0 0 1 2.5 1L19 2l3 3-2 1.5a8 8 0 0 1 1 3.5l1 1v4h-2a8 8 0 0 1-1 2.5Z"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
};
const sections = [
  { key: "home", id: "home", label: "서비스 소개", icon: "home" },
  { key: "platform", id: "platform-operations", label: "운영 체계 안내", icon: "flow" },
] as const;

export function LandingHeader({ showSections = true }: { showSections?: boolean } = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compactNavigation, setCompactNavigation] = useState(false);
  const [healthPanelOpen, setHealthPanelOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const activeSectionRef = useRef("home");
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);
  const health = useSystemHealth();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSidebarOpen(false); setHealthPanelOpen(false); setOpenGroups(new Set()); if (compactNavigation) mobileTriggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [compactNavigation]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => { setCompactNavigation(media.matches); setSidebarOpen(false); setTooltip(null); };
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!compactNavigation || !sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => sidebarToggleRef.current?.focus());
    return () => { window.cancelAnimationFrame(focusFrame); document.body.style.overflow = previousOverflow; };
  }, [compactNavigation, sidebarOpen]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const key=sections.find((section) => section.id === visible.target.id)?.key ?? "home";
      activeSectionRef.current=key;setActiveSection(key);
    }, { rootMargin: "-20% 0px -55%", threshold: [0, 0.2, 0.5] });
    [...new Set(sections.map(({id})=>id))].forEach((id) => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, []);

  const close = (restoreFocus = false) => { setSidebarOpen(false); setTooltip(null); if (restoreFocus && compactNavigation) window.requestAnimationFrame(() => mobileTriggerRef.current?.focus()); };
  const scrollTo = (id: string, key: string) => {
    activeSectionRef.current=key;setActiveSection(key);
    if(key==="platform")window.dispatchEvent(new CustomEvent("roadbogo:platform-slide",{detail:{key:"operation"}}));
    close();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const isPublicHome = pathname === "/";
  const showWorkSidebar = Boolean(user);
  const showPublicSidebar = isPublicHome || showWorkSidebar;
  const showPublicDrawer = showPublicSidebar && compactNavigation;
  const role = (["SYSTEM_ADMIN","CONTROL_MANAGER","CONTROLLER","RESPONDER","GENERAL_USER"] as UserRole[]).includes(user?.role as UserRole) ? user?.role as UserRole : "GENERAL_USER";
  const isSystemAdmin = user?.role === "SYSTEM_ADMIN";
  const isControlManager = user?.role === "CONTROL_MANAGER";
  const sidebarMenus = useMemo(() => {
    return user ? getAuthenticatedSidebarMenus(user) : getLandingSidebarMenus(role, false);
  }, [role, user]);
  const activeMenuId=useMemo(()=>getActiveSidebarMenuId(sidebarMenus,pathname),[pathname,sidebarMenus]);
  const groupedMenus = useMemo(() => sidebarMenus.reduce<Record<string, SidebarMenuItem[]>>((groups, item) => { const section = item.section ?? "메뉴"; (groups[section] ??= []).push(item); return groups; }, {}), [sidebarMenus]);
  const healthBadge = health.isLoading ? "확인 중" : health.status === "healthy" ? "정상" : health.status === "degraded" ? "점검" : "장애";
  const healthStateLabel = health.isLoading ? "확인 중" : health.status === "healthy" ? "정상" : health.status === "degraded" ? "경고" : "장애";

  useEffect(() => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (!sidebarOpen && !compactNavigation) {
        sidebarMenus.forEach((item) => { if (item.children?.length) next.delete(item.id); });
        return next.size === current.size && [...next].every((id) => current.has(id)) ? current : next;
      }
      sidebarMenus.forEach((item) => {
        if (item.children?.length&&(item.href===pathname||item.children.some((child) => child.href === pathname || (child.href !== "/" && pathname.startsWith(child.href ?? "\u0000"))))) next.add(item.id);
      });
      return next.size === current.size && [...next].every((id) => current.has(id)) ? current : next;
    });
  }, [compactNavigation, pathname, sidebarMenus, sidebarOpen]);

  return <>
    {showPublicSidebar && <aside ref={sidebarRef} id="landing-sidebar" className={`landing-sidebar landing-public-drawer${isPublicHome ? " is-home-sidebar" : ""}${isSystemAdmin ? " is-system-admin" : ""}${isControlManager ? " is-control-manager" : ""} ${sidebarOpen ? "is-open" : "is-collapsed"}`} aria-label="주요 메뉴" onKeyDown={(event)=>{if(!compactNavigation||event.key!=="Tab")return;const focusable=sidebarRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]');if(!focusable?.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}}>
      <div className="landing-sidebar__frame">
        <div className="landing-sidebar__header"><button ref={sidebarToggleRef} type="button" className="landing-sidebar__toggle" aria-label={compactNavigation?(sidebarOpen?"메뉴 닫기":"메뉴 열기"):(sidebarOpen?"메뉴 접기":"메뉴 펼치기")} aria-expanded={sidebarOpen} aria-controls="landing-sidebar-nav" onClick={() => compactNavigation && sidebarOpen ? close(true) : setSidebarOpen((value) => !value)}><MenuIcon /><span>운영 메뉴</span></button></div>
        <nav id="landing-sidebar-nav" className="landing-sidebar__navigation" aria-label="페이지 바로가기">
          {Object.entries(groupedMenus).map(([section,items])=><div className="landing-sidebar__group" key={section}><p>{section}</p>{items.map(item=>{
            const childActive=Boolean(item.children?.some(child=>child.id===activeMenuId));
            const isActive=item.targetSection?activeSection===item.id:activeMenuId===item.id;
            const hasChildren=Boolean(item.children?.length),expanded=openGroups.has(item.id);
            const navigate=()=>{if(item.targetSection)scrollTo(item.targetSection,item.id);else if(item.href){close();if(item.isExternal)window.open(item.href,"_blank","noopener,noreferrer");else router.push(item.href)}};
            const showTooltip=(event:React.FocusEvent<HTMLButtonElement>|React.MouseEvent<HTMLButtonElement>)=>{if(!compactNavigation&&!sidebarOpen){const rect=event.currentTarget.getBoundingClientRect();setTooltip({label:item.label,top:rect.top+rect.height/2})}};
            return <div className={`landing-sidebar__menu landing-sidebar__menu--${item.id}${hasChildren?" has-children":""}`} key={item.id}>
              <div className="landing-sidebar__parent">
                <button type="button" className={`${isActive?"is-active":""}${childActive?" is-group-active":""}`} aria-label={item.id==="admin"?"관리 콘솔로 이동":item.label} aria-current={isActive?"page":undefined} onClick={navigate} onMouseEnter={showTooltip} onMouseLeave={()=>setTooltip(null)} onFocus={showTooltip} onBlur={()=>setTooltip(null)}>
                  <span className="landing-sidebar__icon"><RailIcon type={item.icon}/></span><span className="landing-sidebar__menu-text"><strong>{item.label}</strong>{item.description&&<small>{item.description}</small>}</span>{item.badge!=null&&<b>{item.badge}</b>}
                </button>
                {hasChildren&&sidebarOpen&&<button type="button" className="landing-sidebar__chevron" aria-label={expanded?"시스템 관리 메뉴 접기":"시스템 관리 메뉴 펼치기"} aria-expanded={expanded} onClick={()=>setOpenGroups(current=>{const next=new Set(current);if(next.has(item.id))next.delete(item.id);else next.add(item.id);return next})}><i className={expanded?"is-expanded":""}>⌄</i></button>}
              </div>
              {hasChildren&&expanded&&sidebarOpen&&<div className="landing-sidebar__children" aria-label={`${item.label} 하위 메뉴`}>{item.children?.map(child=>{const isChildActive=child.id===activeMenuId;return <button type="button" className={isChildActive?"is-active":""} aria-current={isChildActive?"page":undefined} key={child.id} onClick={()=>{if(!child.href)return;close();router.push(child.href)}}><span className="landing-sidebar__menu-text"><strong>{child.label}</strong></span></button>})}</div>}
            </div>;
          })}</div>)}
        </nav>
        <footer className="landing-sidebar__footer"><button type="button" className={`landing-sidebar__status landing-sidebar__health is-${health.isLoading?"loading":health.status}`} onClick={()=>setHealthPanelOpen(true)} aria-label={`시스템 상태 · ${healthStateLabel}`} onMouseEnter={(event)=>{if(!compactNavigation&&!sidebarOpen){const rect=event.currentTarget.getBoundingClientRect();setTooltip({label:`시스템 상태 · ${healthStateLabel}`,top:rect.top+rect.height/2})}}} onMouseLeave={()=>setTooltip(null)} onFocus={(event)=>{if(!compactNavigation&&!sidebarOpen){const rect=event.currentTarget.getBoundingClientRect();setTooltip({label:`시스템 상태 · ${healthStateLabel}`,top:rect.top+rect.height/2})}}} onBlur={()=>setTooltip(null)}><span className="landing-sidebar__health-icon"><ServerIcon/><i/></span>{sidebarOpen&&<><div className="landing-sidebar__health-copy" role="status" aria-live="polite"><strong>시스템 상태</strong><span>서비스 연결 상태</span></div><span className="landing-sidebar__health-badge">{healthBadge}</span></>}</button></footer>
      </div>
      {tooltip&&<span className="landing-sidebar__tooltip" style={{top:tooltip.top}} role="tooltip">{tooltip.label}</span>}
    </aside>}
    {showPublicSidebar && <button type="button" className={`landing-sidebar-backdrop ${sidebarOpen ? "is-open" : ""}`} onClick={()=>close(true)} aria-label="메뉴 닫기" tabIndex={sidebarOpen&&compactNavigation ? 0 : -1} />}
    {showWorkSidebar && <span className="landing-global-work-spacer" aria-hidden="true"/>}
    <header className="main-header"><div className="main-header__inner">
      <Link className="standalone-sidebar-brand" href="/" aria-label="도로보GO 홈">
        <Image className="standalone-sidebar-brand__full" src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={170} height={48} priority />
        <Image className="standalone-sidebar-brand__mark" src="/brand/roadbogo-symbol.png" alt="" width={48} height={48} aria-hidden="true" priority />
        <span className="standalone-sidebar-brand__mobile-copy"><strong>도로보GO</strong><small>AI 기반 도로 안전 대응</small></span>
      </Link>
      {showSections && !compactNavigation && <nav className="main-header__sections" aria-label="서비스 섹션">{sections.map((section) => <button type="button" key={section.key} className={activeSection === section.key ? "is-active" : ""} aria-current={activeSection === section.key ? "location" : undefined} onClick={() => scrollTo(section.id, section.key)}>{section.label}</button>)}</nav>}
      <div className={`main-header__right${showSections ? "" : " main-header__right--without-sections"}${user ? " main-header__right--authenticated" : ""}`}><nav className="main-header__account" aria-label="계정 메뉴">{!user ? <><Link href="/login?intent=general" className="main-header__login">로그인</Link><Link href="/login?intent=operations" className="main-header__cta">실시간 관제 보기</Link></> : <><NotificationPopover /><AccountMenu /></>}</nav></div>
      {showPublicDrawer && <button ref={mobileTriggerRef} type="button" className="mobile-menu-trigger" aria-label={sidebarOpen?"메뉴 닫기":"메뉴 열기"} aria-expanded={sidebarOpen} aria-controls="landing-sidebar" onClick={() => setSidebarOpen(true)}><MenuIcon /></button>}
    </div></header>
    <SystemHealthPanel open={healthPanelOpen} status={health.status} api={health.api} database={health.database} checkedAt={health.checkedAt} isLoading={health.isLoading} onRefresh={()=>void health.refresh()} onClose={()=>setHealthPanelOpen(false)}/>
  </>;
}
