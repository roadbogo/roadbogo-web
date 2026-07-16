"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { SystemHealthPanel } from "./SystemHealthPanel";
import { getLandingSidebarMenus, type SidebarIconName, type SidebarMenuItem } from "./sidebarMenuConfig";
import type { UserRole } from "@/types/auth";

const MenuIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const BellIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
const ServerIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></svg>;
const RailIcon = ({ type }: { type: SidebarIconName }) => {
  const paths = {
    home: <path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4Z" />,
    flow: <><circle cx="5" cy="12" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 12h4a4 4 0 0 0 4-4M11 12a4 4 0 0 1 4 4" /></>,
    login: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="m14 8 4 4-4 4M18 12H8"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
};
const sections = [
  { key: "home", id: "home", label: "서비스 소개", icon: "home" },
  { key: "platform", id: "platform-operations", label: "통합 사건 운영 체계", icon: "flow" },
] as const;

export function LandingHeader() {
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
      if (event.key === "Escape") { setSidebarOpen(false); setHealthPanelOpen(false); if (compactNavigation) mobileTriggerRef.current?.focus(); }
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
    window.requestAnimationFrame(() => sidebarToggleRef.current?.focus());
    return () => { document.body.style.overflow = previousOverflow; };
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
  const showPublicSidebar = isPublicHome;
  const showPublicDrawer = showPublicSidebar && compactNavigation;
  const role = (["SYSTEM_ADMIN","CONTROL_MANAGER","CONTROLLER","RESPONDER","GENERAL_USER"] as UserRole[]).includes(user?.role as UserRole) ? user?.role as UserRole : "GENERAL_USER";
  const sidebarMenus = useMemo(() => getLandingSidebarMenus(role, Boolean(user)), [role, user]);
  const groupedMenus = useMemo(() => sidebarMenus.reduce<Record<string, SidebarMenuItem[]>>((groups, item) => { const section = item.section ?? "메뉴"; (groups[section] ??= []).push(item); return groups; }, {}), [sidebarMenus]);
  const isAdmin = Boolean(user?.permissions?.includes("users:manage") || user?.roles?.includes("SYSTEM_ADMIN"));
  const healthLabel = health.isLoading ? "상태 확인 중" : health.status === "healthy" ? "서버 정상" : health.status === "degraded" ? "일부 기능 점검" : "서버 연결 확인";

  useEffect(() => {
    setOpenGroups((current) => {
      const next = new Set(current);
      sidebarMenus.forEach((item) => {
        if (item.children?.some((child) => child.href === pathname || (child.href !== "/" && pathname.startsWith(child.href ?? "\u0000")))) next.add(item.id);
      });
      return next.size === current.size && [...next].every((id) => current.has(id)) ? current : next;
    });
  }, [pathname, sidebarMenus]);

  return <>
    {showPublicSidebar && <aside ref={sidebarRef} id="landing-sidebar" className={`landing-sidebar landing-public-drawer ${sidebarOpen ? "is-open" : "is-collapsed"}`} aria-label="공개 페이지 메뉴" onKeyDown={(event)=>{if(!compactNavigation||event.key!=="Tab")return;const focusable=sidebarRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]');if(!focusable?.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}}>
      <div className="landing-sidebar__frame">
        <div className="landing-sidebar__header"><button ref={sidebarToggleRef} type="button" className="landing-sidebar__toggle" aria-label={compactNavigation?(sidebarOpen?"메뉴 닫기":"메뉴 열기"):(sidebarOpen?"사이드바 접기":"사이드바 펼치기")} aria-expanded={sidebarOpen} aria-controls="landing-sidebar-nav" onClick={() => compactNavigation && sidebarOpen ? close(true) : setSidebarOpen((value) => !value)}><MenuIcon /><span>전체 메뉴</span></button></div>
        <nav id="landing-sidebar-nav" className="landing-sidebar__navigation" aria-label="페이지 바로가기">
          {Object.entries(groupedMenus).map(([section, items])=><div className="landing-sidebar__group" key={section}><p>{section}</p>{items.map((item)=>{const isActive=item.targetSection?activeSection===item.id:pathname===item.href;const hasChildren=Boolean(item.children?.length);const expanded=openGroups.has(item.id);const activate=()=>{if(hasChildren){setOpenGroups(current=>{const next=new Set(current);if(next.has(item.id))next.delete(item.id);else next.add(item.id);return next});return}if(item.targetSection){scrollTo(item.targetSection,item.id)}else if(item.href){close();if(item.isExternal)window.open(item.href,"_blank","noopener,noreferrer");else router.push(item.href)}};return <div className="landing-sidebar__menu" key={item.id}><button type="button" className={isActive?"is-active":""} aria-current={isActive?"page":undefined} aria-expanded={hasChildren?expanded:undefined} onClick={activate} onMouseEnter={(event)=>{if(!compactNavigation&&!sidebarOpen){const rect=event.currentTarget.getBoundingClientRect();setTooltip({label:item.label,top:rect.top+rect.height/2})}}} onMouseLeave={()=>setTooltip(null)} onFocus={(event)=>{if(!compactNavigation&&!sidebarOpen){const rect=event.currentTarget.getBoundingClientRect();setTooltip({label:item.label,top:rect.top+rect.height/2})}}} onBlur={()=>setTooltip(null)}><span className="landing-sidebar__icon"><RailIcon type={item.icon}/></span><span className="landing-sidebar__menu-text"><strong>{item.label}</strong>{item.description&&<small>{item.description}</small>}</span>{item.badge!=null&&<b>{item.badge}</b>}{hasChildren&&<i className={expanded?"is-expanded":""}>⌄</i>}</button>{hasChildren&&expanded&&<div className="landing-sidebar__children">{item.children?.map(child=><button type="button" key={child.id} onClick={()=>child.href&&router.push(child.href)}><span className="landing-sidebar__menu-text"><strong>{child.label}</strong>{child.description&&<small>{child.description}</small>}</span></button>)}</div>}</div>})}</div>)}
        </nav>
        <div className="landing-sidebar__footer"><button type="button" className={`landing-sidebar__status landing-sidebar__health is-${health.isLoading?"loading":health.status}`} onClick={()=>setHealthPanelOpen(true)} aria-label={`서버 상태: ${healthLabel}`} onMouseEnter={(event)=>{if(!compactNavigation&&!sidebarOpen){const rect=event.currentTarget.getBoundingClientRect();setTooltip({label:`서버 상태 · ${healthLabel}`,top:rect.top+rect.height/2})}}} onMouseLeave={()=>setTooltip(null)} onFocus={(event)=>{if(!compactNavigation&&!sidebarOpen){const rect=event.currentTarget.getBoundingClientRect();setTooltip({label:`서버 상태 · ${healthLabel}`,top:rect.top+rect.height/2})}}} onBlur={()=>setTooltip(null)}><span className="landing-sidebar__health-icon"><ServerIcon/><i/></span><div><strong>서버 상태</strong><span>{healthLabel}</span></div></button></div>
      </div>
      {tooltip&&<span className="landing-sidebar__tooltip" style={{top:tooltip.top}} role="tooltip">{tooltip.label}</span>}
    </aside>}
    {showPublicSidebar && <button type="button" className={`landing-sidebar-backdrop ${sidebarOpen ? "is-open" : ""}`} onClick={()=>close(true)} aria-label="메뉴 닫기" tabIndex={sidebarOpen&&compactNavigation ? 0 : -1} />}
    <header className="main-header"><div className="main-header__inner">
      <Link className="standalone-sidebar-brand" href="/" aria-label="도로보GO 홈">
        <Image className="standalone-sidebar-brand__full" src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={170} height={48} priority />
        <Image className="standalone-sidebar-brand__mark" src="/brand/roadbogo-symbol.png" alt="" width={48} height={48} aria-hidden="true" priority />
        <span className="standalone-sidebar-brand__mobile-copy"><strong>도로보GO</strong><small>AI 기반 도로 안전 대응</small></span>
      </Link>
      {!compactNavigation && <nav className="main-header__sections" aria-label="서비스 섹션">{sections.map((section) => <button type="button" key={section.key} className={activeSection === section.key ? "is-active" : ""} aria-current={activeSection === section.key ? "location" : undefined} onClick={() => scrollTo(section.id, section.key)}>{section.label}</button>)}</nav>}
      <div className="main-header__right"><nav className="main-header__account" aria-label="계정 메뉴">{!user ? <><Link href="/login?intent=general" className="main-header__login">로그인</Link><Link href="/login?intent=operations" className="main-header__cta">실시간 관제 보기</Link></> : <><button type="button" className="header-bell" aria-label="알림"><BellIcon /></button>{isAdmin && <Link href="/control">관리자</Link>}<AccountMenu /></>}</nav></div>
      {showPublicDrawer && <button ref={mobileTriggerRef} type="button" className="mobile-menu-trigger" aria-label="메뉴 열기" aria-expanded={sidebarOpen} aria-controls="landing-sidebar" onClick={() => setSidebarOpen(true)}><MenuIcon /></button>}
    </div></header>
    <SystemHealthPanel open={healthPanelOpen} status={health.status} api={health.api} database={health.database} checkedAt={health.checkedAt} isLoading={health.isLoading} onRefresh={()=>void health.refresh()} onClose={()=>setHealthPanelOpen(false)}/>
  </>;
}
