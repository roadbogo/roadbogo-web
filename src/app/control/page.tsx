"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ActivityLog } from "@/components/control/ActivityLog";
import { CctvFocusModal } from "@/components/control/CctvFocusModal";
import { DemoControls } from "@/components/control/DemoControls";
import { IncidentControls } from "@/components/control/IncidentControls";
import { IncidentDetailPanel } from "@/components/control/IncidentDetailPanel";
import { ToastList } from "@/components/control/ToastList";
import { useAuth } from "@/components/auth/AuthContext";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { getWorkMenu } from "@/components/navigation/navigationConfig";
import {
  initialActivityLog,
  initialCctvFeeds,
  initialDispatchTeams,
  initialIncidents,
  toastDurations
} from "@/components/control/mockData";
import type {
  ActivityLogEntry,
  CctvFeed,
  FilterOption,
  Incident,
  SortOption,
  ToastMessage
} from "@/components/control/controlTypes";
import "./styles.css";

const initialSearch = "";
const initialFilter: FilterOption = "all";
const initialSort: SortOption = "risk";

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, "");

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const getElapsedSeconds = (start: Date, currentTime: number, stop?: Date) => {
  return Math.max(0, Math.round(((stop?.getTime() ?? currentTime) - start.getTime()) / 1000));
};

const computeElapsedDuration = (startTs: string, currentTime: number, stopTs?: string) => {
  const startDate = new Date(startTs);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }
  const stopDate = stopTs ? new Date(stopTs) : undefined;
  return formatDuration(getElapsedSeconds(startDate, currentTime, stopDate));
};

const parseWaitDuration = (waiting: string) => {
  const [minutes, seconds] = waiting.split(":").map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
};

const getTimerForIncident = (incident: Incident, currentTime: number | null) => {
  if (currentTime === null) {
    return {
      detection: "--:--",
      claim: null,
      dispatch: null
    };
  }

  return {
    detection: incident.detectedAtTs ? computeElapsedDuration(incident.detectedAtTs, currentTime) ?? "--:--" : "--:--",
    claim: incident.claimedAtTs ? computeElapsedDuration(incident.claimedAtTs, currentTime) : null,
    dispatch: incident.dispatchRequestedAtTs ? computeElapsedDuration(incident.dispatchRequestedAtTs, currentTime) : null
  };
};

const filterIncident = (incident: Incident, search: string, filter: FilterOption) => {
  if (filter !== "all" && incident.severity !== filter) {
    return false;
  }

  if (!search.trim()) {
    return true;
  }

  const query = normalizeText(search);
  const target = [incident.number, incident.road, incident.type, incident.direction, incident.cctvId]
    .map(normalizeText)
    .join(" ");

  return target.includes(query);
};

const sortIncidents = (a: Incident, b: Incident, sortOption: SortOption) => {
  if (a.highlighted !== b.highlighted) {
    return a.highlighted ? -1 : 1;
  }

  if (sortOption === "risk") {
    if (b.risk !== a.risk) {
      return b.risk - a.risk;
    }
    const waitA = parseWaitDuration(a.waiting);
    const waitB = parseWaitDuration(b.waiting);
    if (waitA !== waitB) {
      return waitB - waitA;
    }
    return b.detectedAt.localeCompare(a.detectedAt);
  }

  if (sortOption === "waiting") {
    const waitA = parseWaitDuration(a.waiting);
    const waitB = parseWaitDuration(b.waiting);
    if (waitB !== waitA) {
      return waitB - waitA;
    }
    return b.detectedAt.localeCompare(a.detectedAt);
  }

  return b.detectedAt.localeCompare(a.detectedAt);
};

export default function ControlPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [cctvFeeds] = useState<CctvFeed[]>(initialCctvFeeds);
  const [dispatchTeams, setDispatchTeams] = useState(initialDispatchTeams);
  const [activityLogs, setActivityLogs] = useState(initialActivityLog);
  const [toastList, setToastList] = useState<ToastMessage[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedCctvId, setSelectedCctvId] = useState<string>(initialCctvFeeds[0].id);
  const [detailOpen, setDetailOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [filterOption, setFilterOption] = useState<FilterOption>(initialFilter);
  const [sortOption, setSortOption] = useState<SortOption>(initialSort);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const workMenu = useMemo(() => getWorkMenu(user?.uiRoles, user?.uiPermissions), [user?.uiRoles, user?.uiPermissions]);
  const currentUser = { name: user?.name ?? "비로그인", role: user?.role ?? "권한 없음" };
  const [demoCount, setDemoCount] = useState(0);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(Date.now());
    };

    updateTime();
    const intervalId = window.setInterval(updateTime, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedIncident = incidents.find((item) => item.id === selectedIncidentId) ?? null;
  const selectedCctv = cctvFeeds.find((feed) => feed.id === selectedCctvId) ?? cctvFeeds[0];

  const filteredIncidents = useMemo(
    () =>
      incidents
        .filter((incident) => filterIncident(incident, searchTerm, filterOption))
        .sort((a, b) => sortIncidents(a, b, sortOption)),
    [incidents, filterOption, searchTerm, sortOption]
  );

  const totalCctv = cctvFeeds.length;
  const totalIncidents = incidents.length;
  const urgentIncidents = incidents.filter((incident) => incident.severity === "긴급" && incident.status !== "falsePositive").length;
  const dispatchCount = incidents.filter((incident) => incident.status === "dispatchRequested" || incident.status === "dispatched").length;

  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen, detailOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (modalOpen) {
        closeCctvModal();
      } else if (detailOpen) {
        closeIncidentPanel();
      } else if (sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen, detailOpen, sidebarOpen]);

  useEffect(() => {
    if (!selectedIncidentId) return;
    if (!filteredIncidents.some((incident) => incident.id === selectedIncidentId)) {
      setSelectedIncidentId(null);
      setDetailOpen(false);
    }
  }, [filteredIncidents, selectedIncidentId]);

  useEffect(() => {
    const highlightedIncident = incidents.find((incident) => incident.highlighted);
    if (!highlightedIncident) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIncidents((prev) =>
        prev.map((incident) =>
          incident.id === highlightedIncident.id ? { ...incident, highlighted: false } : incident
        )
      );
    }, 6000);

    return () => window.clearTimeout(timeout);
  }, [incidents]);

  const addLog = (entry: {
    title: string;
    message: string;
    incidentId?: string;
    actionLabel?: string;
    variant: ActivityLogEntry["variant"];
  }) => {
    setActivityLogs((prev) => [
      {
        id: String(Date.now()),
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        actor: "운영자_01",
        action: entry.message,
        target: entry.incidentId ? `INC-${entry.incidentId}` : "",
        badge: entry.title,
        variant: entry.variant
      },
      ...prev
    ]);
  };

  const addToast = (toast: Omit<ToastMessage, "id">) => {
    setToastList((prev) => {
      if (prev.some((item) => item.title === toast.title && item.message === toast.message)) {
        return prev;
      }
      const newToast: ToastMessage = {
        id: String(Date.now()),
        duration: toast.duration ?? toastDurations[toast.type],
        ...toast
      };
      return [newToast, ...prev];
    });
  };

  useEffect(() => {
    if (toastList.length === 0) return;
    const timers = toastList.map((toast) =>
      window.setTimeout(() => {
        setToastList((prev) => prev.filter((item) => item.id !== toast.id));
      }, toast.duration)
    );

    return () => timers.forEach(window.clearTimeout);
  }, [toastList]);

  const openIncidentPanel = (incidentId: string, opener: HTMLElement) => {
    lastFocusedRef.current = opener;
    setSelectedIncidentId(incidentId);
    setDetailOpen(true);
  };

  const closeIncidentPanel = () => {
    setDetailOpen(false);
    setSelectedIncidentId(null);
    lastFocusedRef.current?.focus();
  };

  const handleToggleFocusMode = () => {
    setFocusMode((prev) => !prev);
  };

  const openCctvModal = (cctvId: string, opener: HTMLElement) => {
    lastFocusedRef.current = opener;
    setSelectedCctvId(cctvId);
    setModalOpen(true);
  };

  const handleDetailCctvClick = (cctvId: string) => {
    openCctvModal(cctvId, document.body as HTMLElement);
  };

  const closeCctvModal = () => {
    setModalOpen(false);
    lastFocusedRef.current?.focus();
  };

  const handleToastDismiss = (toastId: string) => {
    setToastList((prev) => prev.filter((toast) => toast.id !== toastId));
  };

  const handleToastAction = (toastId: string) => {
    const toast = toastList.find((item) => item.id === toastId);
    if (!toast || !toast.incidentId) return;
    const incident = incidents.find((item) => item.id === toast.incidentId);
    if (!incident) return;
    setToastList((prev) => prev.filter((item) => item.id !== toastId));
    openIncidentPanel(incident.id, lastFocusedRef.current ?? document.body);
  };

  const updateIncident = (incidentId: string, updater: (incident: Incident) => Incident) => {
    setIncidents((prev) => prev.map((incident) => (incident.id === incidentId ? updater(incident) : incident)));
  };

  const handleClaim = () => {
    if (!selectedIncident) return;
    if (selectedIncident.status !== "new") return;

    updateIncident(selectedIncident.id, (incident) => ({
      ...incident,
      status: "claimed",
      assignedTo: "운영자_01",
      claimedAtTs: new Date().toISOString()
    }));
    addToast({
      type: "success",
      title: "사건 선점 완료",
      message: `${selectedIncident.number}을 운영자_01이 선점했습니다.`,
      incidentId: selectedIncident.id
    });
    addLog({
      title: "사건 선점",
      message: `${selectedIncident.number} 사건을 선점했습니다.`,
      incidentId: selectedIncident.id,
      actionLabel: "선점됨",
      variant: "success"
    });
  };

  const handleConfirm = () => {
    if (!selectedIncident || selectedIncident.status !== "claimed") return;

    updateIncident(selectedIncident.id, (incident) => ({
      ...incident,
      status: "confirmed"
    }));
    addToast({
      type: "success",
      title: "위험 판정 완료",
      message: `${selectedIncident.number}을 실제 위험으로 판정했습니다.`,
      incidentId: selectedIncident.id
    });
    addLog({
      title: "위험 판정",
      message: `${selectedIncident.number}을 실제 위험으로 판정했습니다.`,
      incidentId: selectedIncident.id,
      actionLabel: "실제 위험",
      variant: "info"
    });
  };

  const handleFalsePositive = () => {
    if (!selectedIncident || selectedIncident.status !== "claimed") return;

    updateIncident(selectedIncident.id, (incident) => ({
      ...incident,
      status: "falsePositive"
    }));
    addToast({
      type: "warning",
      title: "오탐 처리 완료",
      message: `${selectedIncident.number}을 오탐으로 처리했습니다.`,
      incidentId: selectedIncident.id
    });
    addLog({
      title: "오탐 처리",
      message: `${selectedIncident.number}을 오탐으로 처리했습니다.`,
      incidentId: selectedIncident.id,
      actionLabel: "오탐",
      variant: "warning"
    });
  };

  const handleDispatchRequest = () => {
    if (!selectedIncident || selectedIncident.status !== "confirmed") return;

    updateIncident(selectedIncident.id, (incident) => ({
      ...incident,
      status: "dispatchRequested",
      dispatchRequested: true,
      dispatchRequestedAtTs: new Date().toISOString()
    }));

    setDispatchTeams((prev) => [
      {
        id: `dispatch-${selectedIncident.id}`,
        name: "대구지사 C-02",
        task: `${selectedIncident.road} ${selectedIncident.direction} ${selectedIncident.segment}`,
        eta: "12분 후",
        status: "출동 준비 중"
      },
      ...prev
    ]);

    addToast({
      type: "success",
      title: "출동 요청 완료",
      message: `${selectedIncident.number} 출동 요청이 등록되었습니다.`,
      incidentId: selectedIncident.id
    });
    addLog({
      title: "출동 요청",
      message: `${selectedIncident.number}에 출동 요청을 보냈습니다.`,
      incidentId: selectedIncident.id,
      actionLabel: "출동 요청",
      variant: "info"
    });
  };

  const handleCctvNavigate = (direction: "prev" | "next") => {
    const currentIndex = cctvFeeds.findIndex((feed) => feed.id === selectedCctvId);
    if (currentIndex === -1) return;
    const nextIndex = direction === "next" ? (currentIndex + 1) % cctvFeeds.length : (currentIndex - 1 + cctvFeeds.length) % cctvFeeds.length;
    setSelectedCctvId(cctvFeeds[nextIndex].id);
  };

  const handleCctvIncidentOpen = (incidentId: string) => {
    setModalOpen(false);
    openIncidentPanel(incidentId, lastFocusedRef.current ?? document.body);
  };

  const handleDemoAddIncident = () => {
    const newIncidentId = `demo-${Date.now()}`;
    const incidentNumber = `INC-${32 + demoCount}`;
    const newIncident: Incident = {
      id: newIncidentId,
      number: incidentNumber,
      status: "new",
      severity: "긴급",
      type: "추돌 사고",
      road: "경부고속도로",
      direction: "부산 방향",
      segment: "기흥IC → 수원신갈IC",
      cctvId: "CCTV 01",
      risk: 95,
      riskLabel: "초고위험",
      evidence: "전방 차량 파손 및 파편 감지",
      detectedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      waiting: "00:00",
      assignedTo: undefined,
      detectedAtTs: new Date().toISOString(),
      dispatchRequested: false,
      highlighted: true
    };

    setIncidents((prev) => prev.map((incident) => ({ ...incident, highlighted: false })));
    setIncidents((prev) => [newIncident, ...prev]);
    setDemoCount((prev) => prev + 1);
    addToast({
      type: "urgent",
      title: "긴급 위험 사건 발생",
      message: `${incidentNumber} ${newIncident.road} ${newIncident.direction}에서 ${newIncident.type}이 탐지되었습니다.`,
      incidentId: newIncidentId,
      actionLabel: "즉시 검토",
      duration: 10000
    });
    addLog({
      title: "신규 사건 발생",
      message: `${incidentNumber} 신규 위험 사건이 감지되었습니다.`,
      incidentId: newIncidentId,
      actionLabel: "신규 사건",
      variant: "info"
    });
  };

  const handleDemoReset = () => {
    const confirmed = window.confirm("모든 데모 상태를 초기화하시겠습니까?\n기존 사건, KPI, 로그, 필터가 복원됩니다.");
    if (!confirmed) return;
    setIncidents(initialIncidents);
    setDispatchTeams(initialDispatchTeams);
    setActivityLogs(initialActivityLog);
    setToastList([]);
    setSearchTerm(initialSearch);
    setFilterOption(initialFilter);
    setSortOption(initialSort);
    setSelectedIncidentId(null);
    setDetailOpen(false);
    setModalOpen(false);
    setDemoCount(0);
    setFocusMode(false);
    addToast({
      type: "info",
      title: "데모 초기화 완료",
      message: "시연용 상태가 초기 상태로 복원되었습니다."
    });
  };

  const handleToastActionClick = (id: string) => {
    handleToastAction(id);
  };

  const selectedCctvIds = selectedIncident ? [selectedIncident.cctvId] : [];
  const selectedCctvSet = new Set(selectedCctvIds);
  const urgentIncidentsList = incidents.filter((incident) => incident.severity === "긴급" && incident.status !== "falsePositive");
  const longestUrgentWait = urgentIncidentsList.reduce((currentMax, incident) => {
    const seconds = parseWaitDuration(incident.waiting);
    return Math.max(currentMax, seconds);
  }, 0);
  const urgentSummary = urgentIncidentsList.length > 0 ? `긴급 사건 ${urgentIncidentsList.length}건 · 가장 오래 대기 중 ${formatDuration(longestUrgentWait)}` : "현재 긴급 대기 사건 없음";

  const handleToastRemove = (id: string) => {
    handleToastDismiss(id);
  };

  return (
    <main className={`control-page ${focusMode ? "control-focus" : ""}`}>
      <ToastList toasts={toastList} onDismiss={handleToastRemove} onAction={handleToastActionClick} />
      <div className="control-shell">
        <header className="control-header control-header--main">
          <div className="control-header__lead">
            <button
              type="button"
              className="control-header__menu"
              aria-label={sidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
              aria-expanded={sidebarOpen}
              aria-controls="control-sidebar"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <a href="/control" className="control-brand-box">
              <Image src="/brand/roadbogo-logo-final.png" alt="도로보GO 로고" width={170} height={48} className="control-brand-box__logo" priority />
              <div className="control-brand-box__text">
                <span className="control-brand-box__name">도로보GO</span>
              </div>
            </a>
            <div className="control-brand-title">
              <p className="control-eyebrow">통합 관제</p>
              <h1 className="control-title">실시간 도로 위험 탐지와 현장 대응</h1>
              <p className="control-subtitle">AI 탐지부터 관제 판단, 출동과 현장 조치까지 하나의 흐름으로 연결합니다.</p>
            </div>
          </div>

          <div className="control-header__meta">
            <button
              type="button"
              className={`control-focus-toggle ${focusMode ? "control-focus-toggle--active" : ""}`}
              onClick={handleToggleFocusMode}
              aria-pressed={focusMode}
            >
              {focusMode ? "일반 화면으로 복귀" : "집중 관제"}
            </button>
            <div className="control-chip control-chip--info">CCTV 정상 {totalCctv}/6</div>
            <div className="control-chip control-chip--info">AI 서버 정상</div>
            <div className="control-chip control-chip--accent">알림 {toastList.length}</div>
            <AccountMenu compact />
          </div>
        </header>

        {/* Sidebar (toggleable) */}
        <nav id="control-sidebar" className={`control-sidebar ${sidebarOpen ? "control-sidebar--open" : "control-sidebar--closed"}`} aria-label="사이드 네비게이션">
          <Link className="control-sidebar__brand" href="/" aria-label="도로보GO 메인으로 이동">
            <Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={162} height={46} priority />
          </Link>
          <div className="control-sidebar__profile">
            <strong>{currentUser.name}</strong>
            <small>{currentUser.role}</small>
          </div>
          <ul className="control-sidebar__nav">
            {workMenu.map(item => <li key={item.key}>{item.href
              ? <Link href={item.href}><span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span></Link>
              : <button type="button"><span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span></button>}
            </li>)}
          </ul>
          <div className="control-sidebar__footer">
            <button type="button" onClick={() => setSidebarOpen(false)}>닫기</button>
          </div>
        </nav>
        <button type="button" className={`control-sidebar-overlay ${sidebarOpen ? "is-open" : ""}`} aria-label="사이드바 닫기" tabIndex={sidebarOpen ? 0 : -1} onClick={() => setSidebarOpen(false)} />

        <div className={`control-urgent-line ${urgentIncidents ? "control-urgent-line--active" : "control-urgent-line--inactive"}`}>
          {urgentSummary}
        </div>

          {focusMode ? (
            <div className="control-kpi-summary">
              <span>전체 {totalIncidents}건 · 긴급 {urgentIncidents}건 · 출동 {dispatchCount}건</span>
            </div>
          ) : (
            <section className="control-kpi-strip" aria-label="운영 지표">
            {[
              { label: "전체 CCTV", value: `${totalCctv}대`, detail: "모두 정상 연결" },
              { label: "오늘 탐지 사건", value: `${totalIncidents}건`, detail: "실시간 감지 중" },
              { label: "긴급 사건", value: `${urgentIncidents}건`, detail: "즉시 대응 필요" },
              { label: "출동 진행 중", value: `${dispatchCount}건`, detail: "현장 대응 중" },
              { label: "평균 관제 확인 시간", value: "02:18", detail: "어제 02:39 대비 개선" }
            ].map((item) => (
              <article key={item.label} className="control-kpi-card">
                <p className="control-kpi-card__label">{item.label}</p>
                <strong className="control-kpi-card__value">{item.value}</strong>
                <p className="control-kpi-card__detail">{item.detail}</p>
              </article>
            ))}
          </section>
          )}

          <div className="control-main-grid">
            <section className="control-panel control-panel--wide">
              <div className="control-panel__header">
                <div>
                  <p className="panel-eyebrow">실시간 CCTV 모니터링</p>
                  <h2 className="panel-title">3×2 CCTV 라이브 뷰</h2>
                </div>
                <span className="panel-badge">LIVE</span>
              </div>

              <div className="cctv-grid">
                {cctvFeeds.map((feed) => (
                  <article
                    key={feed.id}
                    className={`cctv-card ${selectedCctvSet.has(feed.id) ? "cctv-card--linked" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => openCctvModal(feed.id, event.currentTarget as HTMLElement)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openCctvModal(feed.id, event.currentTarget as HTMLElement);
                      }
                    }}
                  >
                    <div className="cctv-card__header">
                      <span>{feed.id}</span>
                      <strong>{feed.event}</strong>
                    </div>
                    <div className="cctv-card__view">
                      <span className="cctv-card__live">{feed.event ? "AI 탐지" : "LIVE"}</span>
                      {feed.event ? <span className="cctv-detection-box" aria-hidden="true" /> : null}
                    </div>
                    <div className="cctv-card__info">
                      <p>{feed.label}</p>
                      <span>{feed.duration}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="control-panel control-panel--right">
              <div className="control-panel__header">
                <div>
                  <p className="panel-eyebrow">AI 판단 대기열</p>
                  <h2 className="panel-title">긴급도 우선 사건</h2>
                </div>
              </div>

              <IncidentControls
                search={searchTerm}
                filter={filterOption}
                sort={sortOption}
                onSearchChange={setSearchTerm}
                onFilterChange={setFilterOption}
                onSortChange={setSortOption}
                onReset={() => {
                  setSearchTerm(initialSearch);
                  setFilterOption(initialFilter);
                  setSortOption(initialSort);
                  addToast({
                    type: "info",
                    title: "필터 초기화",
                    message: "검색어와 필터가 초기 상태로 복원되었습니다."
                  });
                }}
              />
              <div className="queue-summary">
                전체 {totalIncidents}건 · 현재 {filteredIncidents.length}건 표시
              </div>

              <div className="queue-list">
                {filteredIncidents.length > 0 ? (
                  filteredIncidents.map((incident) => {
                    const timer = getTimerForIncident(incident, currentTime);
                    return (
                      <article
                        key={incident.id}
                        className={`queue-card ${selectedIncidentId === incident.id ? "queue-card--selected" : ""} ${incident.highlighted ? "queue-card--highlight" : ""} ${incident.status === "falsePositive" || incident.status === "resolved" ? "queue-card--inactive" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedIncidentId === incident.id}
                        onClick={(event) => openIncidentPanel(incident.id, event.currentTarget as HTMLElement)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openIncidentPanel(incident.id, event.currentTarget as HTMLElement);
                          }
                        }}
                      >
                        <div className={`queue-badge queue-badge--${incident.severity === "긴급" ? "danger" : incident.severity === "주의" ? "warning" : "review"}`}>
                          {incident.severity}
                        </div>
                        <h3>{incident.number}</h3>
                        <p>{incident.road} · {incident.direction}</p>
                        <div className="queue-card__meta">
                          <span>{incident.waiting} 대기</span>
                          <span>{incident.status === "dispatchRequested" ? "출동 요청" : incident.status === "confirmed" ? "위험 확인" : incident.status === "claimed" ? "선점됨" : "대기 중"}</span>
                        </div>
                        <div className="queue-card__timer">
                          탐지 후 {timer.detection} 경과
                          {timer.claim ? ` · 선점 후 ${timer.claim} 경과` : ""}
                          {timer.dispatch ? ` · 출동 요청 후 ${timer.dispatch} 경과` : ""}
                        </div>
                        <div className="queue-card__status">{incident.riskLabel}</div>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <p className="empty-state__title">조건에 맞는 사건이 없습니다.</p>
                    <p className="empty-state__text">검색어 또는 필터를 변경해보세요.</p>
                    <button type="button" className="empty-state__reset" onClick={() => {
                      setSearchTerm(initialSearch);
                      setFilterOption(initialFilter);
                      setSortOption(initialSort);
                    }}>
                      초기화
                    </button>
                  </div>
                )}
              </div>

              <div className="dispatch-panel">
                <p className="panel-eyebrow">출동 담당자</p>
                {dispatchTeams.map((team) => (
                  <article key={team.id} className="dispatch-card">
                    <strong>{team.name}</strong>
                    <p>{team.task}</p>
                    <div className="dispatch-card__meta">
                      <span>{team.eta}</span>
                      <span>{team.status}</span>
                    </div>
                  </article>
                ))}
              </div>

              <DemoControls onAddIncident={handleDemoAddIncident} onReset={handleDemoReset} />
            </aside>
          </div>

          <section className="control-bottom-grid">
            <article className="control-card control-card--metric">
              <div className="control-card__header">
                <p className="panel-eyebrow">위험 유형 분포</p>
                <h3>오늘 탐지 위험 분포</h3>
              </div>
              <div className="metric-list">
                <div>
                  <strong>{totalIncidents}건</strong>
                  <span>전체 탐지</span>
                </div>
                <div>
                  <strong>{urgentIncidents}건</strong>
                  <span>긴급 우선</span>
                </div>
                <div>
                  <strong>{dispatchCount}건</strong>
                  <span>출동 단계</span>
                </div>
              </div>
              <div className="metric-chart" />
            </article>

            <article className="control-card control-card--metric">
              <div className="control-card__header">
                <p className="panel-eyebrow">시간대별 위험 발생</p>
                <h3>오늘 오전/오후 추이</h3>
              </div>
              <div className="timeline-chart" />
            </article>

            <article className="control-card control-card--map">
              <div className="control-card__header">
                <p className="panel-eyebrow">도로 상황 지도</p>
                <h3>실시간 주요 구간</h3>
              </div>
              <div className="map-view" />
            </article>

            <article className="control-card control-card--log">
              <ActivityLog logs={activityLogs} onLogActivate={(incidentId) => openIncidentPanel(incidentId, document.body as HTMLElement)} />
            </article>
          </section>
      </div>
      <IncidentDetailPanel
        incident={selectedIncident}
        open={detailOpen}
        onClose={closeIncidentPanel}
        onClaim={handleClaim}
        onConfirm={handleConfirm}
        onFalsePositive={handleFalsePositive}
        onDispatchRequest={handleDispatchRequest}
        onCctvClick={handleDetailCctvClick}
      />
      <CctvFocusModal
        open={modalOpen}
        cctv={selectedCctv}
        relatedIncidents={incidents.filter((incident) => selectedCctv.relatedIncidentIds.includes(incident.id))}
        onClose={closeCctvModal}
        onPrev={() => handleCctvNavigate("prev")}
        onNext={() => handleCctvNavigate("next")}
        onOpenIncident={handleCctvIncidentOpen}
      />
    </main>
  );
}
