"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { dispatchStatusLabel, formatKst, incidentStatusLabel, riskLabel } from "@/features/control-dashboard/dashboardDomain";
import { directionLabel, objectCategoryLabel } from "@/features/control-dashboard/dashboardMapper";
import { createIdempotencyKey } from "@/lib/apiClient";
import { canCompareEvidence, dedupeEvidences, isIncidentActionSupported, reasonLabel, resolveIncidentWorkspaceMode, resolvePrimaryIncidentAction } from "./incidentDetailDomain";
import { createIncidentDetailAdapter } from "./incidentDetailAdapterFactory";
import type { DispatchResponderOption, IncidentCommandAction, IncidentDecisionPayload, IncidentDetailRecord, IncidentEvidence } from "./incidentDetailTypes";
import "@/components/landing/landing.css";
import "./incidentDetail.css";
import "./incidentCommand.css";

const adapter = createIncidentDetailAdapter();
const flow = ["AI 탐지", "사건 생성", "관제 검토", "출동 대응", "현장 조치", "관제 종료"];
const actionDescription: Record<string, string> = {
  acknowledge: "신규 사건을 확인 상태로 변경합니다. 확인 후 사건 선점이 가능합니다.",
  claim: "이 사건의 담당 관제자로 지정됩니다.",
  review: "탐지 근거를 검토하고 위험 여부 판단을 시작합니다.",
  decide: "검토한 근거를 토대로 위험 여부와 출동 필요 여부를 판정합니다.",
  assign: "출동 담당자를 선택해 현장 확인과 조치를 요청합니다.",
  close: "현장 조치 결과를 확인하고 사건을 종료합니다.",
};

function elapsedLabel(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "1분 미만 경과";
  if (minutes < 60) return `${minutes}분 경과`;
  const hours = Math.floor(minutes / 60);
  return `${hours}시간 ${minutes % 60}분 경과`;
}

function evidenceTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
}

function EvidenceFigure({ evidence, annotated, compact = false }: { evidence: IncidentEvidence; annotated: boolean; compact?: boolean }) {
  const src = annotated ? evidence.annotated_image_url ?? evidence.original_image_url : evidence.original_image_url;
  const objectName = evidence.class_name ?? "분류 정보 없음";
  return (
    <figure className={`console-evidence${compact ? " is-compact" : ""}`}>
      {src ? (
        <div className="console-evidence__image">
          <Image src={src} alt={`${objectName} 사건 탐지 근거`} fill loading="eager" sizes="(max-width: 1024px) 100vw, 70vw" />
          {annotated && !evidence.annotated_image_url && evidence.bbox && (
            <span className="incident-bbox" style={{ left: `${evidence.bbox.x * 100}%`, top: `${evidence.bbox.y * 100}%`, width: `${evidence.bbox.width * 100}%`, height: `${evidence.bbox.height * 100}%` }}>
              <b>{objectName}</b>
            </span>
          )}
        </div>
      ) : <p className="console-empty">표시할 탐지 이미지가 없습니다.</p>}
    </figure>
  );
}

function EvidenceCompareViewer({ evidence }: { evidence: IncidentEvidence }) {
  const [position, setPosition] = useState(50);
  const src = evidence.original_image_url;
  if (!canCompareEvidence(evidence) || !src || !evidence.bbox) return <p className="compare-unavailable">동일한 원본 프레임과 탐지 좌표가 없어 비교할 수 없습니다.</p>;
  const objectName = evidence.class_name ?? "탐지 객체";
  return <figure className="compare-viewer">
    <div className="compare-canvas">
      <Image src={src} alt={`${objectName} 원본 프레임`} fill loading="eager" sizes="(max-width: 1024px) 100vw, 70vw" />
      <div className="compare-after" style={{ clipPath: `inset(0 0 0 ${position}%)` }} aria-hidden="true">
        <Image src={src} alt="" fill loading="eager" sizes="(max-width: 1024px) 100vw, 70vw" />
        <span className="incident-bbox is-primary" style={{ left: `${evidence.bbox.x * 100}%`, top: `${evidence.bbox.y * 100}%`, width: `${evidence.bbox.width * 100}%`, height: `${evidence.bbox.height * 100}%` }}><b>현재 사건 근거 · {objectName}</b></span>
      </div>
      <span className="compare-label is-before">원본</span><span className="compare-label is-after">AI 결과</span><i className="compare-divider" style={{ left: `${position}%` }} aria-hidden="true" />
      <input type="range" min="0" max="100" value={position} onChange={event => setPosition(Number(event.target.value))} aria-label="원본과 AI 결과 비교 위치" />
    </div>
    <figcaption>{evidenceTime(evidence.detected_at)} KST · 동일 CCTV·촬영 시각·원본 프레임 비교</figcaption>
  </figure>;
}

function RiskCandidateSummary({ evidence }: { evidence: IncidentEvidence }) {
  const [expanded, setExpanded] = useState(false);
  const confidence = evidence.confidence === null ? "정보 없음" : `${Math.round(evidence.confidence * 100)}%`;
  return (
    <section className="risk-summary">
      <header>
        <div><span>SELECTED EVIDENCE</span><h3>선택 근거 분석</h3></div>
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "분석 근거 접기" : "분석 근거 펼치기"}</button>
      </header>
      <p><strong>현재 사건 근거 · {evidence.class_name ?? "탐지 객체"}</strong></p>
      <p className="risk-summary__headline">대표 신뢰도 {confidence} · 위험 점수 {evidence.risk.risk_score} · {evidence.risk.risk_grade}</p>
      <dl>
        <div><dt>신뢰도</dt><dd>{confidence}</dd></div><div><dt>위험 점수</dt><dd>{evidence.risk.risk_score} <small>/ 100</small></dd></div>
        <div><dt>위험 등급</dt><dd>{evidence.risk.risk_grade}</dd></div><div><dt>지속시간</dt><dd>{(evidence.risk.duration_ms / 1000).toFixed(1)}초</dd></div>
        <div><dt>반복 탐지</dt><dd>{evidence.risk.repeat_count}회</dd></div><div><dt>추적 객체</dt><dd>{evidence.risk.track_id ?? "정보 없음"}</dd></div>
      </dl>
      {expanded && <div className="risk-summary__reasons">{evidence.risk.reason_codes.length ? evidence.risk.reason_codes.map(code => <span key={code}>✓ {reasonLabel[code] ?? code}</span>) : <span>제공된 상세 분석 근거가 없습니다.</span>}</div>}
      <p className="risk-summary__notice">AI 분석은 위험 후보 판단을 지원하는 정보이며, 실제 위험 여부와 출동 필요 여부는 관제자가 결정합니다.</p>
    </section>
  );
}

function CompactProgress({ status }: { status: IncidentDetailRecord["incident"]["status"] }) {
  const current = status === "NEW" ? 0 : status === "ACKNOWLEDGED" ? 1 : ["CLAIMED", "UNDER_REVIEW"].includes(status) ? 2 : ["DISPATCH_REQUESTED", "DISPATCHED"].includes(status) ? 3 : ["ON_SCENE", "ACTION_IN_PROGRESS", "ACTION_COMPLETED"].includes(status) ? 4 : 5;
  return <div className="compact-progress" aria-label="사건 처리 진행 단계">{flow.map((label, index) => <span key={label} className={index < current ? "is-done" : index === current ? "is-current" : ""}><i aria-hidden="true">{index < current ? "✓" : index === current ? "●" : "○"}</i>{label}</span>)}</div>;
}

function DetailTabs({ record }: { record: IncidentDetailRecord }) {
  const tabs = useMemo(() => [
    { key: "history", label: `처리 이력 ${record.histories.length}건` },
    record.controller_note ? { key: "memo", label: "관제 메모" } : null,
    record.dispatch ? { key: "dispatch", label: "출동 정보" } : null,
  ].filter(Boolean) as { key: string; label: string }[], [record]);
  const [active, setActive] = useState(tabs[0]?.key ?? "history");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => { if (!tabs.some(tab => tab.key === active)) setActive(tabs[0]?.key ?? "history"); }, [active, tabs]);
  const move = (index: number, direction: number) => { const next = (index + direction + tabs.length) % tabs.length; setActive(tabs[next].key); tabRefs.current[next]?.focus(); };
  return <section className="detail-tabs"><div className="detail-tabs__list" role="tablist" aria-label="사건 상세 정보">{tabs.map((tab, index) => <button key={tab.key} ref={node => { tabRefs.current[index] = node; }} role="tab" aria-selected={active === tab.key} onClick={() => setActive(tab.key)} onKeyDown={event => { if (event.key === "ArrowRight") move(index, 1); if (event.key === "ArrowLeft") move(index, -1); }}>{tab.label}</button>)}</div>
    <div className="detail-tabs__panel" role="tabpanel">
      {active === "history" && <div className="activity-list">{record.histories.map(item => <article key={item.public_id}><i /><div><strong>{item.label}</strong><span>{item.actor_name ?? "시스템"} · <time>{formatKst(item.occurred_at)} KST</time></span><p>{item.detail ?? "사건 상태가 갱신되었습니다."}</p></div></article>)}</div>}
      {active === "memo" && <div className="memo-panel"><strong>관제 메모</strong><p>{record.controller_note ?? "등록된 관제 메모가 없습니다."}</p></div>}
      {active === "dispatch" && record.dispatch && <dl className="dispatch-facts"><div><dt>출동 담당자</dt><dd>{record.dispatch.responder_label}</dd></div><div><dt>출동 상태</dt><dd>{dispatchStatusLabel[record.dispatch.status]}</dd></div><div><dt>요청 시각</dt><dd>{formatKst(record.dispatch.requested_at)} KST</dd></div><div><dt>최근 갱신</dt><dd>{formatKst(record.dispatch.updated_at)} KST</dd></div></dl>}
    </div>
  </section>;
}

export function IncidentCommandWorkspace({ publicId, invalidIdentifier = false }: { publicId: string; invalidIdentifier?: boolean }) {
  const { user } = useAuth();
  const [record, setRecord] = useState<IncidentDetailRecord | null>(null);
  const [loading, setLoading] = useState(!invalidIdentifier), [missing, setMissing] = useState(false), [error, setError] = useState("");
  const [view, setView] = useState<"annotated" | "original" | "compare">("annotated"), [selectedEvidence, setSelectedEvidence] = useState(""), [showAll, setShowAll] = useState(false);
  const [dialog, setDialog] = useState<"decision" | "dispatch" | "close" | null>(null), [busy, setBusy] = useState(false), [toast, setToast] = useState("");
  const busyRef = useRef(false);
  const load = useCallback(async () => { if (invalidIdentifier) return false; setLoading(true); setError(""); try { const next = await adapter.get(publicId); if (!next) { setMissing(true); return false; } setRecord(next); setMissing(false); setSelectedEvidence(current => current || next.evidences.find(item => item.is_representative)?.detection_public_id || next.evidences[0]?.detection_public_id || ""); return true; } catch { setError("사건 상세 정보를 불러오지 못했습니다."); return false; } finally { setLoading(false); } }, [invalidIdentifier, publicId]);
  const refreshManually=useCallback(async()=>{if(await load())setToast("최신 사건 상태를 불러왔습니다.");},[load]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!toast) return; const timer=window.setTimeout(() => setToast(""), 4500); return () => window.clearTimeout(timer); }, [toast]);
  const evidences = useMemo(() => dedupeEvidences(record?.evidences ?? []), [record]);
  const evidence = evidences.find(item => item.detection_public_id === selectedEvidence) ?? evidences[0];
  const mode = record ? resolveIncidentWorkspaceMode(record.incident.status) : null;
  const primary = useMemo(() => { const candidate = record && user ? resolvePrimaryIncidentAction(record.incident, { public_id: user.publicId ?? "", permissions: user.apiPermissions }) : null; if (candidate?.key === "assign" && record?.dispatch) return null; if (candidate && ["view_dispatch", "view_field"].includes(candidate.key)) return null; return candidate && !isIncidentActionSupported(adapter.mode,candidate.key) ? null : candidate; }, [record, user]);

  const perform = async (action: IncidentCommandAction, payload?: IncidentDecisionPayload | { responder_public_id: string; request_message: string }) => {
    if (!record || busyRef.current) return; busyRef.current = true; setBusy(true); const idempotencyKey = createIdempotencyKey();
    try {
      const result = action === "assign" && payload && "responder_public_id" in payload
        ? await adapter.assignDispatch({ incident_public_id: record.incident.public_id, responder_public_id: payload.responder_public_id, request_message: payload.request_message.trim() || null, expected_version_no: record.incident.version_no, idempotency_key: idempotencyKey })
        : await adapter.act({ incident_public_id: record.incident.public_id, expected_version_no: record.incident.version_no, action, idempotency_key: idempotencyKey, payload: payload ?? (action === "claim" || action === "release" ? { actor_public_id: user?.publicId ?? "", actor_name: user?.name ?? "관제 담당자" } : undefined) });
      if (result.ok) { setRecord(current => current ? { ...current, incident: { ...current.incident, status: result.status, version_no: result.version_no } } : current); const latest = result.record ?? await adapter.get(record.incident.public_id); if (latest) setRecord(latest); const successMessage:Partial<Record<IncidentCommandAction,string>>={acknowledge:"사건을 확인했습니다.",claim:"이 사건의 담당자로 지정되었습니다.",release:"사건 담당이 해제되었습니다.",review:"사건 검토를 시작했습니다.",decide:"위험 판정을 반영했습니다.",assign:"출동 담당자를 배정했습니다.",close:"사건 종료를 확인했습니다."}; setToast(successMessage[action]??"사건 처리를 완료했습니다."); setDialog(null); }
      else { setRecord(result.latest); const messages: Record<string, string> = { INCIDENT_VERSION_CONFLICT: "사건 정보가 변경되어 최신 상태를 불러왔습니다.", INCIDENT_ALREADY_CLAIMED: `다른 관제자가 이미 선점했습니다.${result.controller_name ? ` 담당자: ${result.controller_name}` : ""}`, INCIDENT_NOT_ASSIGNED_CONTROLLER: "현재 담당 관제자만 사건 검토를 시작할 수 있습니다.", INCIDENT_INVALID_STATE_TRANSITION: "현재 사건 상태에서는 이 작업을 수행할 수 없습니다.", DISPATCH_RESPONDER_NOT_FOUND: "출동 담당자를 찾을 수 없습니다.", DISPATCH_RESPONDER_UNAVAILABLE: "선택한 담당자는 현재 출동할 수 없습니다.", DISPATCH_RESPONDER_BUSY: "선택한 담당자가 다른 출동을 진행 중입니다.", DISPATCH_ALREADY_ASSIGNED: "이 사건에는 이미 활성 출동이 있습니다.", DISPATCH_IDEMPOTENCY_CONFLICT: "동일 멱등 키로 다른 출동 요청이 확인되었습니다.", INCIDENT_CLAIM_CONFLICT: "다른 관제자가 먼저 선점했습니다.", FORBIDDEN: "현재 권한으로 이 작업을 수행할 수 없습니다.", INVALID_TRANSITION: "현재 사건 상태에서 이 작업을 수행할 수 없습니다." }; setToast(messages[result.code] ?? "요청을 처리하지 못했습니다."); }
    } catch { setToast("요청을 처리하지 못했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요."); } finally { busyRef.current = false; setBusy(false); }
  };

  if (invalidIdentifier) return <StatePage title="사건 주소를 확인해 주세요" body="올바르지 않거나 더 이상 사용할 수 없는 사건 주소입니다." />;
  if (loading && !record) return <><LandingHeader showSections={false} /><main className="incident-state" role="status">사건 상세 정보를 불러오고 있습니다.</main></>;
  if (missing) return <StatePage title="사건을 찾을 수 없습니다" body="삭제되었거나 접근할 수 없는 사건입니다." />;
  if (error || !record) return <><LandingHeader showSections={false} /><main className="incident-state"><p>{error}</p><button onClick={() => void load()}>다시 시도</button></main></>;

  const { incident, cctv } = record;
  const recentHistories=[...record.histories].sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at)).slice(0,3);
  const assignedHistory=[...record.histories].reverse().find(item=>item.label==="담당 지정");
  return <div className="incident-page"><LandingHeader showSections={false} />{toast && <div className="incident-toast" role="status">{toast}<button aria-label="안내 닫기" onClick={() => setToast("")}>×</button></div>}
    <main className="incident-shell incident-console">
      <section className="console-status">
        <Link className="incident-back" href="/control" aria-label="사건 목록으로 돌아가기"><span aria-hidden="true">←</span> 사건 목록</Link>
        <div className="console-status__row"><div><h1>{incident.incident_no}</h1><p className="console-object"><strong>{incident.class_name ?? objectCategoryLabel[incident.object_category]}</strong></p><div className="console-badges"><b>{riskLabel[incident.current_risk_grade]} 위험</b><b>{incidentStatusLabel[incident.status]}</b><b>{incident.assigned_controller?.public_id === user?.publicId ? "내 담당" : incident.assigned_controller?.display_name ?? "담당 미지정"}</b></div><p>{cctv.cctv_name} · {cctv.road.road_name}</p><p>{cctv.road_section.section_name} · {directionLabel[cctv.direction_code]}</p><small>최초 탐지 {formatKst(incident.created_at)} KST · 최근 탐지 {formatKst(evidences.at(-1)?.detected_at ?? incident.updated_at)} KST · 탐지 {incident.detection_count}회 · {elapsedLabel(incident.created_at)}</small></div></div>
      </section>
      <div className="console-layout">
        <section className="evidence-console"><header><span>EVIDENCE REVIEW</span><h2>증거 판단 작업대</h2></header>{evidence ? <><p className="control-label">보기 방식</p><div className="evidence-tabs" role="tablist" aria-label="탐지 이미지 보기 방식">{([['annotated','AI 탐지 결과'],['original','원본 이미지'],['compare','비교']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}>{label}</button>)}</div><div className="evidence-toolbar"><span><strong>현재 사건 근거 · {evidence.class_name ?? "분류 정보 없음"}</strong> · 신뢰도 {evidence.confidence === null ? "정보 없음" : `${Math.round(evidence.confidence * 100)}%`} · {evidenceTime(evidence.detected_at)} KST</span>{(evidence.annotated_image_url ?? evidence.original_image_url) && <a href={view === "original" || view === "compare" ? evidence.original_image_url ?? "" : evidence.annotated_image_url ?? evidence.original_image_url ?? ""} target="_blank" rel="noreferrer">확대 보기</a>}</div><div className={`console-evidence-view is-${view}`}>{view === "annotated" && <EvidenceFigure evidence={evidence} annotated />}{view === "original" && <EvidenceFigure evidence={evidence} annotated={false} />}{view === "compare" && <EvidenceCompareViewer evidence={evidence} />}</div><section className="evidence-strip"><header><h3>증거 타임라인 {evidences.length}건</h3><span>탐지 시각과 신뢰도를 비교해 선택합니다</span></header><div>{evidences.slice(0, showAll ? evidences.length : 4).map((item,index) => { const thumbnail = item.annotated_image_url ?? item.original_image_url; const selected = item.detection_public_id === evidence.detection_public_id; const visible=evidences.slice(0,showAll?evidences.length:4); return <button key={item.detection_public_id} className={selected ? "is-active" : ""} aria-pressed={selected} onClick={() => setSelectedEvidence(item.detection_public_id)} onKeyDown={event=>{if(event.key!=="ArrowRight"&&event.key!=="ArrowLeft")return;event.preventDefault();const next=visible[(index+(event.key==="ArrowRight"?1:-1)+visible.length)%visible.length];setSelectedEvidence(next.detection_public_id);document.querySelector<HTMLButtonElement>(`[data-evidence-id="${next.detection_public_id}"]`)?.focus()}} data-evidence-id={item.detection_public_id}>{thumbnail && <span><Image src={thumbnail} alt="" fill sizes="78px" /></span>}<strong>{item.class_name ?? "분류 정보 없음"}</strong><time>{evidenceTime(item.detected_at)} KST</time><small>{item.confidence === null ? "신뢰도 정보 없음" : `신뢰도 ${Math.round(item.confidence * 100)}%`}</small><em>{item.is_representative ? "대표 근거" : selected ? "현재 선택" : "추가 근거"}</em></button>; })}{evidences.length > 4 && <button className="evidence-strip__more" onClick={() => setShowAll(value => !value)}>{showAll ? "근거 접기" : "전체 근거 보기"}</button>}</div></section><RiskCandidateSummary evidence={evidence} /></> : <p className="console-empty">제공된 탐지 근거가 없습니다.</p>}</section>
        <aside className="command-panel" id="incident-command">
          <header><span>INCIDENT COMMAND</span><h2>사건 처리</h2><div className="command-badges"><b>{incidentStatusLabel[incident.status]}</b><b>{incident.assigned_controller?.public_id===user?.publicId?"내 담당":incident.assigned_controller?"담당 지정":"담당 미지정"}</b></div></header>
          <div className="command-next"><span>다음 업무</span><strong>{primary?.label ?? (mode === "READ_ONLY" ? "처리 완료" : "현재 가능한 업무 없음")}</strong><p>{primary ? actionDescription[primary.key] : mode === "READ_ONLY" ? "최종 처리된 사건입니다." : "현재 계정에는 이 단계의 사건 처리 권한이 없거나 아직 지원되지 않는 업무입니다."}</p></div>
          {primary && <button className="incident-primary" disabled={busy} aria-busy={busy} onClick={() => primary.key === "decide" ? setDialog("decision") : primary.key === "assign" ? setDialog("dispatch") : primary.key === "close" ? setDialog("close") : void perform(primary.key as IncidentCommandAction)}>{busy ? primary.key === "claim" ? "담당 지정 중" : "처리 중" : primary.label}</button>}
          <p className="incident-permission-note">{primary?.key === "acknowledge" || primary?.key === "claim" ? "사건 확인 및 선점 권한이 필요합니다." : primary?.key === "review" || primary?.key === "decide" ? "사건 검토 권한이 필요합니다." : primary?.key === "assign" ? "출동 배정 권한이 필요합니다." : "권한과 사건 상태에 따라 업무가 제공됩니다."}</p>
          <dl className="command-summary"><div><dt>사건 상태</dt><dd>{incidentStatusLabel[incident.status]}</dd></div><div><dt>담당 관제자</dt><dd>{incident.assigned_controller?.display_name ?? "미배정"}</dd></div><div><dt>탐지 객체</dt><dd>{incident.class_name ?? objectCategoryLabel[incident.object_category]}</dd></div><div><dt>AI 위험도</dt><dd>{riskLabel[incident.current_risk_grade]}</dd></div><div><dt>CCTV</dt><dd>{cctv.cctv_name}</dd></div><div><dt>위치</dt><dd>{cctv.road.road_name} · {cctv.road_section.section_name} · {directionLabel[cctv.direction_code]}</dd></div></dl>
          {evidence && <dl className="command-ai"><div><dt>AI 신뢰도</dt><dd>{evidence.confidence === null ? "정보 없음" : `${Math.round(evidence.confidence * 100)}%`}</dd></div><div><dt>탐지 지속시간</dt><dd>{(evidence.risk.duration_ms / 1000).toFixed(1)}초</dd></div><div><dt>탐지 횟수</dt><dd>{evidence.risk.repeat_count}회</dd></div><div><dt>AI 위험 점수</dt><dd>{evidence.risk.risk_score}</dd></div></dl>}
          <section className="command-stage"><span>현재 처리 상태</span><strong>{incident.status === "NEW" ? "사건 접수" : incident.status === "ACKNOWLEDGED" ? "사건 확인 완료" : incident.status === "CLAIMED" ? "담당 지정 완료" : incident.status === "UNDER_REVIEW" ? "위험 판정 진행" : mode === "FIELD_RESPONSE" ? "출동 대응" : mode === "CLOSURE_REVIEW" ? "현장 조치" : "관제 종료"}</strong><CompactProgress status={incident.status} /></section>
          <section className="command-history"><span>최근 처리 기록</span>{recentHistories.map(item=><div key={item.public_id}><time>{evidenceTime(item.occurred_at)}</time><p><strong>{item.actor_name??"시스템"}</strong> · {item.label}</p></div>)}</section>
          <dl className="command-assignee"><div><dt>담당 관제자</dt><dd>{incident.assigned_controller?.display_name??"담당 미지정"}</dd></div><div><dt>담당 상태</dt><dd>{incident.assigned_controller?.public_id===user?.publicId?"내 담당":incident.assigned_controller?"다른 담당자":"미지정"}</dd></div><div><dt>담당 시각</dt><dd>{assignedHistory?`${evidenceTime(assignedHistory.occurred_at)} KST`:"-"}</dd></div></dl>
          {record.controller_note ? <p className="command-note"><strong>최근 관제 메모</strong>{record.controller_note}</p> : <p className="command-note"><strong>최근 관제 메모</strong>등록된 메모가 없습니다.</p>}
          <div className="sync-compact" role="status"><strong>● 실시간 연결 끊김</strong><small>마지막 동기화 {formatKst(incident.updated_at).split(" ").at(-1)}</small><button type="button" disabled={loading} onClick={() => void refreshManually()}>최신 상태 불러오기</button></div>
          {incident.status === "CLAIMED" && adapter.mode === "mock" && <button className="incident-secondary" disabled={!adapter.supportsRelease} title={adapter.supportsRelease ? "선점 해제" : "준비 중"} onClick={() => adapter.supportsRelease && void perform("release")}>{adapter.supportsRelease ? "선점 해제" : "선점 해제 · 준비 중"}</button>}
        </aside>
      </div>
      <DetailTabs record={record} />
    </main>{dialog && <ActionDialog type={dialog} busy={busy} onClose={() => setDialog(null)} onConfirm={payload => void perform(dialog === "decision" ? "decide" : dialog === "dispatch" ? "assign" : "close", payload)} />}</div>;
}

function StatePage({ title, body }: { title: string; body: string }) { return <><LandingHeader showSections={false} /><main className="incident-state"><h1>{title}</h1><p>{body}</p><Link href="/control">관제로 돌아가기</Link></main></>; }

function ActionDialog({ type, busy, onClose, onConfirm }: { type: "decision" | "dispatch" | "close"; busy: boolean; onClose: () => void; onConfirm: (payload?: IncidentDecisionPayload | { responder_public_id: string; request_message: string }) => void }) {
  const [decisionType, setDecisionType] = useState<IncidentDecisionPayload["decision_type"]>("REAL_RISK"), [reason, setReason] = useState("");
  const [responders, setResponders] = useState<DispatchResponderOption[]>([]), [responderId, setResponderId] = useState(""), [message, setMessage] = useState("현장 확인 및 조치를 요청합니다."), [respondersLoading, setRespondersLoading] = useState(false), [respondersError, setRespondersError] = useState("");
  useEffect(() => { if (type !== "dispatch" || !adapter.supportsDispatchAssignment) return; setRespondersLoading(true); adapter.listResponders().then(items => { setResponders(items); setResponderId(items.find(item => item.available)?.public_id ?? ""); }).catch(() => setRespondersError("출동 담당자를 불러오지 못했습니다.")).finally(() => setRespondersLoading(false)); }, [type]);
  const invalid = type === "decision" ? !reason.trim() : type === "dispatch" ? !responderId || !adapter.supportsDispatchAssignment : false;
  return <div className="incident-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="incident-dialog" role="dialog" aria-modal="true" aria-labelledby="incident-dialog-title"><h2 id="incident-dialog-title">{type === "decision" ? "위험 여부 판정" : type === "dispatch" ? "출동 담당자 배정" : "사건 종료 확인"}</h2><p>{type === "decision" ? "판정 결과와 사유를 확인해 주세요." : type === "dispatch" ? "배정할 출동 담당자를 선택해 주세요." : "현장 조치 결과를 확인하고 사건을 종료합니다."}</p>{type === "decision" && <><fieldset className="incident-decision-options"><legend>판정 결과</legend>{([['REAL_RISK','실제 위험'],['FALSE_POSITIVE','오탐'],['NEEDS_REVIEW','추가 검토'],['NO_DISPATCH','출동 불필요']] as const).map(([value, label]) => <label key={value}><input type="radio" name="decision-type" checked={decisionType === value} onChange={() => setDecisionType(value)} /><span>{label}</span></label>)}</fieldset><label>판정 사유<textarea value={reason} onChange={event => setReason(event.target.value)} /></label></>}{type === "dispatch" && <><label>출동 담당자<select value={responderId} disabled={!adapter.supportsDispatchAssignment || respondersLoading || !!respondersError} onChange={event => setResponderId(event.target.value)}><option value="">{respondersLoading ? "담당자를 불러오는 중입니다" : adapter.supportsDispatchAssignment ? "담당자를 선택하세요" : "출동 배정 준비 중"}</option>{responders.map(item => <option key={item.public_id} value={item.public_id} disabled={!item.available}>{item.display_name}{item.organization_name ? ` · ${item.organization_name}` : ""}{item.available ? "" : " · 배정 불가"}</option>)}</select></label>{respondersError && <p role="alert">{respondersError}</p>}<label>관제 요청 메시지<textarea value={message} disabled={!adapter.supportsDispatchAssignment} onChange={event => setMessage(event.target.value)} /></label></>}<div><button onClick={onClose}>취소</button><button disabled={busy || invalid} onClick={() => onConfirm(type === "decision" ? { decision_type: decisionType, decision_reason: reason.trim() } : type === "dispatch" ? { responder_public_id: responderId, request_message: message.trim() } : undefined)}>{busy ? "처리 중" : "확인"}</button></div></section></div>;
}
