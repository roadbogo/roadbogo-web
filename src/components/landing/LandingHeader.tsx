"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";

const MenuIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const BellIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
type RailIconType = "home" | "monitor";
const RailIcon = ({ type }: { type: RailIconType }) => {
  const paths = {
    home: <path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4Z" />,
    monitor: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
};
const sections = [
  { key: "home", id: "home", label: "홈", icon: "home" },
  { key: "monitor", id: "incident-stage", label: "실시간 관제", icon: "monitor" },
] as const;

export function LandingHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSidebarOpen(false); setProfile(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      setActiveSection(visible.target.id === "incident-stage" ? "monitor" : "home");
    }, { rootMargin: "-20% 0px -55%", threshold: [0, 0.2, 0.5] });
    ["home", "incident-stage"].forEach((id) => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, []);

  const close = () => setSidebarOpen(false);
  const scrollTo = (id: string, key: string) => {
    setActiveSection(key);
    close();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const signout = () => { logout(); setProfile(false); close(); router.push("/"); };

  return <>
    <Link className="standalone-sidebar-brand" href="/" aria-label="도로보GO 홈"><Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={170} height={48} priority /></Link>
    <aside id="landing-sidebar" className={`landing-sidebar ${sidebarOpen ? "is-open" : "is-collapsed"}`} aria-label="페이지 섹션 메뉴">
      <button type="button" className="landing-sidebar__toggle" aria-label="페이지 메뉴 열기" aria-expanded={sidebarOpen} aria-controls="landing-sidebar-nav" onClick={() => setSidebarOpen((value) => !value)}><MenuIcon /><span>전체 메뉴</span></button>
      <nav id="landing-sidebar-nav" aria-label="페이지 바로가기">
        {sections.map((section) => <button type="button" key={section.key} className={activeSection === section.key ? "is-active" : ""} aria-current={activeSection === section.key ? "location" : undefined} onClick={() => scrollTo(section.id, section.key)}><RailIcon type={section.icon} /><span>{section.label}</span></button>)}
      </nav>
      <div className="landing-sidebar__status"><i /><div><strong>시스템 정상</strong><span>실시간 연결 상태</span></div></div>
    </aside>
    <button type="button" className={`landing-sidebar-backdrop ${sidebarOpen ? "is-open" : ""}`} onClick={close} aria-label="메뉴 닫기" tabIndex={sidebarOpen ? 0 : -1} />
    <header className="main-header"><div className="main-header__inner">
      <div aria-hidden="true" />
      <nav className="main-header__account" aria-label="계정 메뉴">{!user ? <><Link href="/signup">회원가입</Link><Link href="/login" className="main-header__login">로그인</Link><Link href="/login" className="main-header__cta">실시간 관제 보기 <span>→</span></Link></> : <><Link href="/mypage">마이페이지</Link><button className="header-bell" aria-label="알림"><BellIcon /></button><div className="profile-wrap"><button className="profile-trigger" aria-expanded={profile} onClick={() => setProfile((value) => !value)}><b>관</b><span><strong>{user.name}</strong><small>{user.role}</small></span></button>{profile && <div className="profile-popover"><div><strong>{user.name}</strong><span>{user.email}</span><small>{user.role}</small></div><Link href="/control">실시간 관제 보기</Link><Link href="/mypage">마이페이지</Link><Link href="/mypage/edit">회원정보 수정</Link><button onClick={signout}>로그아웃</button></div>}</div><Link href="/control" className="main-header__cta">실시간 관제 보기 <span>→</span></Link></>}</nav>
      <button type="button" className="mobile-menu-trigger" aria-label="메뉴 열기" aria-expanded={sidebarOpen} aria-controls="landing-sidebar" onClick={() => setSidebarOpen(true)}><MenuIcon /></button>
    </div></header>
  </>;
}
