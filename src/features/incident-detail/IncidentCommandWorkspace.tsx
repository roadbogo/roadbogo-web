"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, type AuthenticatedUser } from "@/components/auth/AuthContext";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { dispatchStatusLabel, formatKst, formatRiskGrade, incidentStatusLabel, riskLabel } from "@/features/control-dashboard/dashboardDomain";
import { directionLabel, objectCategoryLabel } from "@/features/control-dashboard/dashboardMapper";
import { ApiError, createIdempotencyKey } from "@/lib/apiClient";
import { canCompareEvidence, dedupeEvidences, isIncidentActionSupported, reasonLabel, resolveIncidentWorkspaceMode, resolveMemoAvailability, resolvePrimaryIncidentAction } from "./incidentDetailDomain";
import { getDetectionVisualVariant } from "@/features/detection/detectionVisualVariant";
import { createIncidentDetailAdapter } from "./incidentDetailAdapterFactory";
import { getIncidentRefreshChanges, resolveEvidenceSelection } from "./incidentRefresh";
import type { DispatchResponderOption, IncidentCommandAction, IncidentDecisionPayload, IncidentDetailRecord, IncidentEvidence, IncidentMemo, IncidentMemoType } from "./incidentDetailTypes";
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
  const visualVariant = getDetectionVisualVariant({objectCategory:evidence.object_category,classCode:evidence.class_code});
  return (
    <figure className={`console-evidence${compact ? " is-compact" : ""}`}>
      {src ? (
        <div className="console-evidence__image">
          <Image src={src} alt={`${objectName} 사건 탐지 근거`} fill loading="eager" sizes="(max-width: 1024px) 100vw, 70vw" />
          {annotated && !evidence.annotated_image_url && evidence.bbox && (
            <span className="incident-bbox" data-visual-variant={visualVariant} style={{ left: `${evidence.bbox.x * 100}%`, top: `${evidence.bbox.y * 100}%`, width: `${evidence.bbox.width * 100}%`, height: `${evidence.bbox.height * 100}%` }}>
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
  const visualVariant = getDetectionVisualVariant({objectCategory:evidence.object_category,classCode:evidence.class_code});
  return <figure className="compare-viewer">
    <div className="compare-canvas">
      <Image src={src} alt={`${objectName} 원본 프레임`} fill loading="eager" sizes="(max-width: 1024px) 100vw, 70vw" />
      <div className="compare-after" style={{ clipPath: `inset(0 0 0 ${position}%)` }} aria-hidden="true">
        <Image src={src} alt="" fill loading="eager" sizes="(max-width: 1024px) 100vw, 70vw" />
        <span className="incident-bbox is-primary" data-visual-variant={visualVariant} style={{ left: `${evidence.bbox.x * 100}%`, top: `${evidence.bbox.y * 100}%`, width: `${evidence.bbox.width * 100}%`, height: `${evidence.bbox.height * 100}%` }}><b>현재 사건 근거 · {objectName}</b></span>
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
      <p className="risk-summary__headline">대표 신뢰도 {confidence} · 위험 점수 {evidence.risk.risk_score} · {formatRiskGrade(evidence.risk.risk_grade)}</p>
      <dl>
        <div><dt>신뢰도</dt><dd>{confidence}</dd></div><div><dt>위험 점수</dt><dd>{evidence.risk.risk_score} <small>/ 100</small></dd></div>
        <div><dt>위험 등급</dt><dd>{formatRiskGrade(evidence.risk.risk_grade)}</dd></div><div><dt>지속시간</dt><dd>{(evidence.risk.duration_ms / 1000).toFixed(1)}초</dd></div>
        <div><dt>반복 탐지</dt><dd>{evidence.risk.repeat_count}회</dd></div><div><dt>추적 객체</dt><dd>{evidence.risk.track_id ?? "정보 없음"}</dd></div>
      </dl>
      {expanded && <div className="risk-summary__reasons">{evidence.risk.reason_codes.length ? evidence.risk.reason_codes.map(code => <span key={code}>✓ {reasonLabel[code] ?? code}</span>) : <span>제공된 상세 분석 근거가 없습니다.</span>}</div>}
      <p className="risk-summary__notice">AI 분석은 위험 후보 판단을 지원하는 정보이며, 실제 위험 여부와 출동 필요 여부는 관제자가 결정합니다.</p>
    </section>
  );
}

function CompactProgress({ status }: { status: IncidentDetailRecord["incident"]["status"] }) {
  const current = status === "NEW" ? 0 : status === "ACKNOWLEDGED" ? 1 : ["CLAIMED", "UNDER_REVIEW"].includes(status) ? 2 : ["DISPATCH_REQUESTED", "DISPATCHED"].includes(status) ? 3 : ["ON_SCENE", "ACTION_IN_PROGRESS", "ACTION_COMPLETED"].includes(status) ? 4 : 5;
  const skipped = status === "FALSE_POSITIVE" ? new Set([3, 4]) : new Set<number>();
  return <div className="compact-progress" aria-label="사건 처리 진행 단계">{flow.map((label, index) => { const state = skipped.has(index) ? "is-skipped" : index < current ? "is-done" : index === current ? "is-current" : "is-pending"; return <span key={label} className={state}><i aria-hidden="true">{skipped.has(index) ? "–" : index < current ? "✓" : index === current ? "●" : "○"}</i>{label}</span>; })}</div>;
}

const memoTypeLabel:Record<IncidentMemoType,string>={GENERAL:"일반",REVIEW:"검토",DISPATCH:"출동",CLOSURE:"종료"};
function DetailTabs({ record,user,onMemoCreated,onRefresh,onNotify }: { record: IncidentDetailRecord;user:AuthenticatedUser|null;onMemoCreated:(memo:IncidentMemo)=>void;onRefresh:()=>Promise<boolean>;onNotify:(message:string)=>void }) {
  const tabs = useMemo(() => [
    { key: "history", label: "처리 이력", count: record.histories.length },
    { key: "memo", label: "관제 메모", count: record.memos.length },
    { key: "dispatch", label: "출동 정보", count: record.dispatch ? 1 : 0 },
  ], [record]);
  const [active, setActive] = useState(tabs[0]?.key ?? "history");
  const [open,setOpen]=useState(false);
  const [memoOpen,setMemoOpen]=useState(false),[memoType,setMemoType]=useState<IncidentMemoType>("GENERAL"),[content,setContent]=useState(""),[memoError,setMemoError]=useState(""),[memoBusy,setMemoBusy]=useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const memoTriggerRef=useRef<HTMLButtonElement>(null),memoDialogRef=useRef<HTMLElement>(null),memoContentRef=useRef<HTMLTextAreaElement>(null),memoBusyRef=useRef(false);
  const availability=user?resolveMemoAvailability(record.incident,{public_id:user.publicId??"",permissions:user.apiPermissions}):{allowed:false,reason:"사용자 정보를 확인한 뒤 메모를 작성할 수 있습니다"};
  useEffect(() => { if (!tabs.some(tab => tab.key === active)) setActive(tabs[0]?.key ?? "history"); }, [active, tabs]);
  useEffect(()=>{if(!memoOpen)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";window.requestAnimationFrame(()=>memoContentRef.current?.focus());const key=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!memoBusy){event.preventDefault();setMemoOpen(false);window.requestAnimationFrame(()=>memoTriggerRef.current?.focus());return}if(event.key!=="Tab"||!memoDialogRef.current)return;const controls=[...memoDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),textarea:not([disabled])')];if(!controls.length)return;const first=controls[0],last=controls.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};document.addEventListener("keydown",key);return()=>{document.removeEventListener("keydown",key);document.body.style.overflow=previousOverflow}},[memoBusy,memoOpen]);
  const move = (index: number, direction: number) => { const next = (index + direction + tabs.length) % tabs.length; setActive(tabs[next].key); tabRefs.current[next]?.focus(); };
  const latestHistoryId = record.histories.at(-1)?.public_id;
  const closeMemo=()=>{if(memoBusy)return;setMemoOpen(false);setMemoType("GENERAL");setContent("");setMemoError("");window.requestAnimationFrame(()=>memoTriggerRef.current?.focus())};
  const saveMemo=async()=>{const trimmed=content.trim();if(!user){setMemoError("사용자 정보를 확인한 뒤 다시 시도해 주세요");return}if(!trimmed){setMemoError("메모 내용을 입력해 주세요");memoContentRef.current?.focus();return}if(trimmed.length>2000){setMemoError("메모는 2,000자 이내로 입력해 주세요");memoContentRef.current?.focus();return}if(memoBusyRef.current)return;memoBusyRef.current=true;setMemoBusy(true);setMemoError("");try{const memo=await adapter.createMemo({incident_public_id:record.incident.public_id,memo_type:memoType,content:trimmed,actor_public_id:user.publicId??"",actor_name:user.name});onMemoCreated(memo);setMemoOpen(false);setMemoType("GENERAL");setContent("");onNotify("관제 메모가 등록되었습니다");window.requestAnimationFrame(()=>memoTriggerRef.current?.focus())}catch(error){if(error instanceof ApiError&&["AUTH_PERMISSION_DENIED","INCIDENT_NOT_ASSIGNED_CONTROLLER"].includes(error.code)){setMemoError("담당 관제자만 메모를 작성할 수 있습니다");await onRefresh()}else if(error instanceof ApiError&&error.code==="INCIDENT_NOT_FOUND")setMemoError("사건 정보를 찾을 수 없습니다");else if(error instanceof ApiError&&error.code==="INCIDENT_INVALID_STATE_TRANSITION"){setMemoError("현재 사건 상태에서는 메모를 작성할 수 없습니다");await onRefresh()}else if(error instanceof ApiError&&error.code==="COMMON_VALIDATION_ERROR")setMemoError("메모 내용을 확인해 주세요");else setMemoError("메모를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요");window.requestAnimationFrame(()=>memoContentRef.current?.focus())}finally{memoBusyRef.current=false;setMemoBusy(false)}};
  return <section className={`detail-tabs ${open?"is-open":""}`}><div className="detail-tabs__bar"><div className="detail-tabs__list" role="tablist" aria-label="사건 기록">{tabs.map((tab, index) => <button key={tab.key} ref={node => { tabRefs.current[index] = node; }} role="tab" aria-selected={active === tab.key} onClick={() => {setActive(tab.key);setOpen(true)}} onKeyDown={event => { if (event.key === "ArrowRight") move(index, 1); if (event.key === "ArrowLeft") move(index, -1); }}>{tab.label}<b aria-label={`${tab.count}건`}>{tab.count}</b></button>)}</div><button className="detail-tabs__toggle" type="button" aria-expanded={open} aria-controls="incident-record-drawer" onClick={()=>setOpen(value=>!value)}>{open?"사건 기록 닫기":"사건 기록 열기"}</button></div>
    <div id="incident-record-drawer" className="detail-tabs__panel" role="tabpanel" hidden={!open}>
      {active === "history" && <div className="activity-list">{record.histories.map(item => <article key={item.public_id} className={item.public_id === latestHistoryId ? "is-latest" : ""}><i /><div><strong>{item.label}</strong><span>{item.actor_name ?? "시스템"} · <time>{formatKst(item.occurred_at)} KST</time></span><p>{item.detail ?? "사건 상태가 갱신되었습니다."}</p></div></article>)}</div>}
      {active === "memo" && <div className="memo-panel"><div><strong>관제 메모</strong><button ref={memoTriggerRef} type="button" disabled={!availability.allowed} aria-describedby="memo-availability" onClick={()=>setMemoOpen(true)}>+ 메모 작성</button></div><p id="memo-availability" className={availability.allowed?"is-available":"is-disabled"}>{availability.reason}</p>{record.memos.length?<div className="memo-list">{[...record.memos].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(memo=><article key={memo.public_id}><b>{memoTypeLabel[memo.memo_type]}</b><p>{memo.content}</p><small>{memo.created_by.user_name} · {formatKst(memo.created_at)} KST</small></article>)}</div>:<div className="memo-empty"><strong>등록된 관제 메모가 없습니다</strong><p>사건을 검토하며 확인한 내용을 기록할 수 있습니다</p></div>}</div>}
      {active === "dispatch" && (record.dispatch?<dl className="dispatch-facts"><div><dt>출동 담당자</dt><dd>{record.dispatch.responder_label}</dd></div><div><dt>출동 상태</dt><dd>{dispatchStatusLabel[record.dispatch.status]}</dd></div><div><dt>요청 시각</dt><dd>{formatKst(record.dispatch.requested_at)} KST</dd></div><div><dt>최근 갱신</dt><dd>{formatKst(record.dispatch.updated_at)} KST</dd></div></dl>:<p className="drawer-empty">연결된 출동 정보가 없습니다.</p>)}
    </div>
    {memoOpen&&<div className="memo-dialog-backdrop" onMouseDown={event=>event.target===event.currentTarget&&closeMemo()}><section ref={memoDialogRef} className="memo-dialog" role="dialog" aria-modal="true" aria-labelledby="memo-dialog-title" aria-describedby="memo-dialog-description" aria-busy={memoBusy}><header><div><h2 id="memo-dialog-title">관제 메모 작성</h2><p id="memo-dialog-description">사건을 검토하며 확인한 내용을 기록합니다</p></div><button type="button" aria-label="관제 메모 작성 창 닫기" disabled={memoBusy} onClick={closeMemo}>×</button></header><div className="memo-dialog__body"><label>메모 유형<select value={memoType} disabled={memoBusy} onChange={event=>setMemoType(event.target.value as IncidentMemoType)}>{Object.entries(memoTypeLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>메모 내용<textarea ref={memoContentRef} value={content} maxLength={2000} disabled={memoBusy} aria-invalid={Boolean(memoError)} aria-describedby="memo-content-count memo-content-error" onChange={event=>{setContent(event.target.value);setMemoError("")}} /></label><div className="memo-dialog__meta"><p id="memo-content-error" role="alert">{memoError}</p><span id="memo-content-count" aria-live="polite">{content.length} / 2000</span></div></div><footer><button type="button" disabled={memoBusy} onClick={closeMemo}>취소</button><button type="button" disabled={memoBusy||!content.trim()} onClick={()=>void saveMemo()}>{memoBusy?"저장 중":"메모 저장"}</button></footer></section></div>}
  </section>;
}

export function IncidentCommandWorkspace({ publicId, invalidIdentifier = false }: { publicId: string; invalidIdentifier?: boolean }) {
  const { user } = useAuth();
  const [record, setRecord] = useState<IncidentDetailRecord | null>(null);
  const [loading, setLoading] = useState(!invalidIdentifier), [missing, setMissing] = useState(false), [error, setError] = useState("");
  const [view, setView] = useState<"annotated" | "original" | "compare">("annotated"), [selectedEvidence, setSelectedEvidence] = useState("");
  const [dialog, setDialog] = useState<"decision" | "dispatch" | "close" | null>(null), [busy, setBusy] = useState(false), [toast, setToast] = useState("");
  const [refreshing,setRefreshing]=useState(false),[syncMessage,setSyncMessage]=useState("");
  const busyRef = useRef(false),refreshingRef=useRef(false);
  const applyRecord=useCallback((next:IncidentDetailRecord)=>{setRecord(current=>current?.incident.public_id===next.incident.public_id&&next.memos.length===0?{...next,memos:current.memos}:next);setMissing(false);setSelectedEvidence(current=>resolveEvidenceSelection(current,next));},[]);
  const load = useCallback(async () => { if (invalidIdentifier) return false; setLoading(true); setError(""); try { const next = await adapter.get(publicId); if (!next) { setMissing(true); return false; } applyRecord(next); return true; } catch { setError("사건 상세 정보를 불러오지 못했습니다."); return false; } finally { setLoading(false); } }, [applyRecord,invalidIdentifier, publicId]);
  const refreshManually=useCallback(async()=>{if(refreshingRef.current||!record)return;refreshingRef.current=true;setRefreshing(true);setSyncMessage("");try{const next=await adapter.get(publicId);if(!next)throw new Error("INCIDENT_NOT_FOUND");const changed=getIncidentRefreshChanges(record,next);applyRecord(next);const checked=evidenceTime(new Date().toISOString());setSyncMessage(changed.length?`사건 상태를 최신 정보로 갱신했습니다 · ${checked} 기준`:`현재 최신 상태입니다 · ${checked} 확인`);}catch{setSyncMessage("최신 상태를 확인하지 못했습니다 · 잠시 후 다시 시도해 주세요");}finally{refreshingRef.current=false;setRefreshing(false)}},[applyRecord,publicId,record]);
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
  const assignedHistory=[...record.histories].reverse().find(item=>item.label==="담당 지정");
  return <div className="incident-page"><LandingHeader showSections={false} />{toast && <div className="incident-toast" role="status">{toast}<button aria-label="안내 닫기" onClick={() => setToast("")}>×</button></div>}
    <main className="incident-shell incident-console">
      <section className="console-status">
        <div className="console-status__main"><Link className="incident-back" href="/control" aria-label="사건 목록으로 돌아가기"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>사건 목록</Link><div className="console-status__identity"><div><h1>{incident.incident_no}</h1><p className="console-object"><strong>{incident.class_name ?? objectCategoryLabel[incident.object_category]}</strong></p></div><div className="console-badges"><b>{riskLabel[incident.current_risk_grade]} 위험</b><b>{incidentStatusLabel[incident.status]}</b><b>{incident.assigned_controller?.public_id === user?.publicId ? "내 담당" : incident.assigned_controller?.display_name ?? "담당 미지정"}</b></div></div><p>{cctv.cctv_name} · {cctv.road.road_name} · {cctv.road_section.section_name} · {directionLabel[cctv.direction_code]}</p><small>최초 {formatKst(incident.created_at)} KST · 최근 {formatKst(evidences.at(-1)?.detected_at ?? incident.updated_at)} KST · 탐지 {incident.detection_count}회 · {elapsedLabel(incident.created_at)}</small></div><div className="console-sync"><strong><i aria-hidden="true"/> 실시간 연결 끊김</strong><small>마지막 동기화 {formatKst(incident.updated_at).split(" ").at(-1)}</small><button type="button" disabled={refreshing} aria-busy={refreshing} onClick={() => void refreshManually()}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"/></svg>{refreshing?"상태 확인 중":"상태 새로고침"}</button><p aria-live="polite">{syncMessage || "연결이 끊긴 동안에는 수동으로 최신 상태를 확인해 주세요."}</p></div>
      </section>
      <div className="console-layout">
        <section className="evidence-console"><header><span>EVIDENCE REVIEW</span><h2>AI 증거 캔버스</h2></header>{evidence ? <><div className="evidence-tabs" role="tablist" aria-label="증거 보기 방식">{([['annotated','탐지 결과'],['original','원본'],['compare','비교']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}>{label}</button>)}</div><div className="evidence-toolbar"><span><strong>현재 선택 근거 · {evidence.class_name ?? "분류 정보 없음"}</strong> · {evidenceTime(evidence.detected_at)} KST</span>{(evidence.annotated_image_url ?? evidence.original_image_url) && <a href={view === "original" || view === "compare" ? evidence.original_image_url ?? "" : evidence.annotated_image_url ?? evidence.original_image_url ?? ""} target="_blank" rel="noreferrer" aria-label="현재 증거 전체 화면으로 열기">⛶ 전체 화면</a>}</div><div className={`console-evidence-view is-${view}`}>{view === "annotated" && <EvidenceFigure evidence={evidence} annotated />}{view === "original" && <EvidenceFigure evidence={evidence} annotated={false} />}{view === "compare" && <EvidenceCompareViewer evidence={evidence} />}</div><section className="evidence-strip"><header><h3>증거 {evidences.length}건</h3></header><div>{evidences.map((item,index) => { const thumbnail = item.annotated_image_url ?? item.original_image_url; const selected = item.detection_public_id === evidence.detection_public_id; return <button key={item.detection_public_id} className={selected ? "is-active" : ""} aria-pressed={selected} onClick={() => setSelectedEvidence(item.detection_public_id)} onKeyDown={event=>{if(event.key!=="ArrowRight"&&event.key!=="ArrowLeft")return;event.preventDefault();const next=evidences[(index+(event.key==="ArrowRight"?1:-1)+evidences.length)%evidences.length];setSelectedEvidence(next.detection_public_id);document.querySelector<HTMLButtonElement>(`[data-evidence-id="${next.detection_public_id}"]`)?.focus()}} data-evidence-id={item.detection_public_id}>{thumbnail && <span><Image src={thumbnail} alt="" fill sizes="78px" /></span>}<strong>{item.class_name ?? "분류 정보 없음"}</strong><time>{evidenceTime(item.detected_at)} KST</time><small>{item.confidence === null ? "신뢰도 정보 없음" : `신뢰도 ${Math.round(item.confidence * 100)}%`}</small><em>{item.is_representative ? "대표 근거" : selected ? "현재 선택" : "추가 근거"}</em></button>; })}</div></section><RiskCandidateSummary evidence={evidence} /></> : <p className="console-empty">제공된 탐지 근거가 없습니다.</p>}</section>
        <aside className="command-panel" id="incident-command">
          <header><span>INCIDENT COMMAND</span><h2>사건 처리</h2><div className="command-badges"><b>{incidentStatusLabel[incident.status]}</b><b>{incident.assigned_controller?.public_id===user?.publicId?"내 담당":incident.assigned_controller?"담당 지정":"담당 미지정"}</b></div></header>
          <section className="command-current-stage"><span>현재 처리 상태</span><strong>{incident.status === "NEW" ? "사건 접수" : incident.status === "ACKNOWLEDGED" ? "사건 확인 완료" : incident.status === "CLAIMED" ? "담당 지정 완료" : incident.status === "UNDER_REVIEW" ? "위험 판정 진행" : mode === "FIELD_RESPONSE" ? "출동 대응" : mode === "CLOSURE_REVIEW" ? "현장 조치" : "관제 종료"}</strong><CompactProgress status={incident.status} /></section>
          {dialog?<ActionDialog type={dialog} busy={busy} embedded onClose={() => setDialog(null)} onConfirm={payload => void perform(dialog === "decision" ? "decide" : dialog === "dispatch" ? "assign" : "close", payload)} />:<><div className="command-next"><span>다음 업무</span><strong>{primary?.label ?? (mode === "READ_ONLY" ? "처리 완료" : "현재 가능한 업무 없음")}</strong><p>{primary ? actionDescription[primary.key] : mode === "READ_ONLY" ? "최종 처리된 사건입니다." : "현재 계정에는 이 단계의 사건 처리 권한이 없거나 아직 지원되지 않는 업무입니다."}</p></div>{primary && <button className="incident-primary" disabled={busy} aria-busy={busy} onClick={() => primary.key === "decide" ? setDialog("decision") : primary.key === "assign" ? setDialog("dispatch") : primary.key === "close" ? setDialog("close") : void perform(primary.key as IncidentCommandAction)}>{busy ? primary.key === "claim" ? "담당 지정 중" : "처리 중" : primary.label}</button>}<p className="incident-permission-note">{primary?.key === "acknowledge" || primary?.key === "claim" ? "사건 확인 및 선점 권한이 필요합니다." : primary?.key === "review" || primary?.key === "decide" ? "사건 검토 권한이 필요합니다." : primary?.key === "assign" ? "출동 배정 권한이 필요합니다." : "권한과 사건 상태에 따라 업무가 제공됩니다."}</p>{incident.status === "CLAIMED" && adapter.mode === "mock" && <button className="incident-secondary" disabled={!adapter.supportsRelease} title={adapter.supportsRelease ? "선점 해제" : "준비 중"} onClick={() => adapter.supportsRelease && void perform("release")}>{adapter.supportsRelease ? "선점 해제" : "선점 해제 · 준비 중"}</button>}</>}
          <dl className="command-assignee"><div><dt>담당 관제자</dt><dd>{incident.assigned_controller?.display_name??"담당 미지정"}</dd></div><div><dt>담당 상태</dt><dd>{incident.assigned_controller?.public_id===user?.publicId?"내 담당":incident.assigned_controller?"다른 담당자":"미지정"}</dd></div><div><dt>담당 시각</dt><dd>{assignedHistory?`${evidenceTime(assignedHistory.occurred_at)} KST`:"-"}</dd></div></dl>
        </aside>
      </div>
      <DetailTabs record={record} user={user} onRefresh={load} onNotify={setToast} onMemoCreated={memo=>setRecord(current=>current?{...current,memos:[memo,...current.memos.filter(item=>item.public_id!==memo.public_id)]}:current)} />
    </main></div>;
}

function StatePage({ title, body }: { title: string; body: string }) { return <><LandingHeader showSections={false} /><main className="incident-state"><h1>{title}</h1><p>{body}</p><Link href="/control">관제로 돌아가기</Link></main></>; }

function ActionDialog({ type, busy, embedded=false, onClose, onConfirm }: { type: "decision" | "dispatch" | "close"; busy: boolean; embedded?:boolean; onClose: () => void; onConfirm: (payload?: IncidentDecisionPayload | { responder_public_id: string; request_message: string }) => void }) {
  const [decisionType, setDecisionType] = useState<IncidentDecisionPayload["decision_type"]>("REAL_RISK"), [reason, setReason] = useState("");
  const [responders, setResponders] = useState<DispatchResponderOption[]>([]), [responderId, setResponderId] = useState(""), [message, setMessage] = useState("현장 확인 및 조치를 요청합니다."), [respondersLoading, setRespondersLoading] = useState(false), [respondersError, setRespondersError] = useState("");
  useEffect(() => { if (type !== "dispatch" || !adapter.supportsDispatchAssignment) return; setRespondersLoading(true); adapter.listResponders().then(items => { setResponders(items); setResponderId(items.find(item => item.available)?.public_id ?? ""); }).catch(() => setRespondersError("출동 담당자를 불러오지 못했습니다.")).finally(() => setRespondersLoading(false)); }, [type]);
  const invalid = type === "decision" ? !reason.trim() : type === "dispatch" ? !responderId || !adapter.supportsDispatchAssignment : false;
  const content=<section className={`incident-dialog ${embedded?"incident-dialog--rail":""}`} role={embedded?"region":"dialog"} aria-modal={embedded?undefined:true} aria-labelledby="incident-dialog-title"><h2 id="incident-dialog-title">{type === "decision" ? "위험 여부 판정" : type === "dispatch" ? "출동 담당자 배정" : "사건 종료 확인"}</h2><p>{type === "decision" ? "판정 결과와 사유를 확인해 주세요." : type === "dispatch" ? "배정할 출동 담당자를 선택해 주세요." : "현장 조치 결과를 확인하고 사건을 종료합니다."}</p>{type === "decision" && <><fieldset className="incident-decision-options"><legend>판정 결과</legend>{([['REAL_RISK','실제 위험'],['FALSE_POSITIVE','오탐'],['NEEDS_REVIEW','추가 검토'],['NO_DISPATCH','출동 불필요']] as const).map(([value, label]) => <label key={value}><input type="radio" name="decision-type" checked={decisionType === value} onChange={() => setDecisionType(value)} /><span>{label}</span></label>)}</fieldset><label>판정 사유<textarea value={reason} onChange={event => setReason(event.target.value)} /></label></>}{type === "dispatch" && <><label>출동 담당자<select value={responderId} disabled={!adapter.supportsDispatchAssignment || respondersLoading || !!respondersError} onChange={event => setResponderId(event.target.value)}><option value="">{respondersLoading ? "담당자를 불러오는 중입니다" : adapter.supportsDispatchAssignment ? "담당자를 선택하세요" : "출동 배정 준비 중"}</option>{responders.map(item => <option key={item.public_id} value={item.public_id} disabled={!item.available}>{item.display_name}{item.organization_name ? ` · ${item.organization_name}` : ""}{item.available ? "" : " · 배정 불가"}</option>)}</select></label>{respondersError && <p role="alert">{respondersError}</p>}<label>관제 요청 메시지<textarea value={message} disabled={!adapter.supportsDispatchAssignment} onChange={event => setMessage(event.target.value)} /></label></>}<div><button onClick={onClose}>취소</button><button disabled={busy || invalid} onClick={() => onConfirm(type === "decision" ? { decision_type: decisionType, decision_reason: reason.trim() } : type === "dispatch" ? { responder_public_id: responderId, request_message: message.trim() } : undefined)}>{busy ? "처리 중" : "확인"}</button></div></section>;
  return embedded?content:<div className="incident-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>{content}</div>;
}
