"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { useAuth, type AuthenticatedUser } from "@/components/auth/AuthContext";
import { DetectionOverlay } from "@/components/landing/DetectionOverlay";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { dispatchStatusLabel, formatKst, formatRiskGrade, incidentStatusLabel, riskLabel } from "@/features/control-dashboard/dashboardDomain";
import { directionLabel, objectCategoryLabel } from "@/features/control-dashboard/dashboardMapper";
import { ApiError, createIdempotencyKey } from "@/lib/apiClient";
import { buildIncidentTimeline, canCompareEvidence, canMutateIncidentMemo, dedupeEvidences, isIncidentActionSupported, normalizeMemoType, reasonLabel, resolveIncidentWorkspaceMode, resolveMemoAvailability, resolvePrimaryIncidentAction, sortIncidentMemos } from "./incidentDetailDomain";
import { getDetectionVisualVariant } from "@/features/detection/detectionVisualVariant";
import { useContainedBbox } from "@/features/detection/containedBbox";
import { createIncidentDetailAdapter } from "./incidentDetailAdapterFactory";
import { clearIncidentMemoDraft, IncidentMemoComposer } from "./IncidentMemoComposer";
import { memoTypeLabel } from "./incidentMemoDraft";
import { FinalDecisionPanel, FinalDecisionSummary } from "./FinalDecisionPanel";
import {FieldActionReview} from "./FieldActionReview";
import { EvidenceFocusDialog, evidenceViewOptions, type EvidenceViewMode } from "./EvidenceFocusDialog";
import { evidenceFocusModeUrl, evidenceFocusSelectionUrl, evidenceFocusUrl, incidentDetailUrl, readEvidenceFocus } from "./evidenceFocusHistory";
import { getIncidentRefreshChanges, resolveEvidenceSelection } from "./incidentRefresh";
import { getEvidenceOverlayBbox } from "./incidentEvidencePresentation";
import { currentIncidentWorkStage, getIncidentWorkStages, incidentWorkStageFlow, type IncidentWorkStage } from "./incidentWorkStages";
import type { DispatchResponderOption, IncidentClosePayload, IncidentCommandAction, IncidentDecisionPayload, IncidentDetailRecord, IncidentEvidence, IncidentMemo, IncidentMemoType } from "./incidentDetailTypes";
import "@/components/landing/landing.css";
import "./incidentDetail.css";
import "./incidentCommand.css";
import "./fieldActionReview.css";

const adapter = createIncidentDetailAdapter();
const actionDescription: Record<string, string> = {
  acknowledge: "AI 탐지 근거를 검토한 뒤 사건을 확인해 주세요.",
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

function evidenceConfidence(value: number | null) {
  return value === null ? null : `${Math.round(value * 100)}%`;
}

export function EvidenceFigure({ evidence, annotated, compact = false, incidentNo }: { evidence: IncidentEvidence; annotated: boolean; compact?: boolean; incidentNo?:string }) {
  const src = annotated ? evidence.annotated_image_url ?? evidence.original_image_url : evidence.original_image_url;
  const objectName = evidence.class_name ?? "분류 정보 없음";
  const [imageState,setImageState]=useState<"loading"|"ready"|"error">("loading"),[retryKey,setRetryKey]=useState(0);
  const visualVariant = getDetectionVisualVariant({objectCategory:evidence.object_category,classCode:evidence.class_code});
  const confidence = evidence.confidence === null ? null : Math.round(evidence.confidence * 100);
  const overlayBbox = getEvidenceOverlayBbox(evidence, annotated ? "annotated" : "original");
  const mediaIdentity = `${evidence.detection_public_id}:${annotated ? "annotated" : "original"}:${src ?? "no-image"}`;
  const { containerRef, onImageLoad, projectedBbox } = useContainedBbox(overlayBbox, mediaIdentity);
  useEffect(()=>setImageState("loading"),[mediaIdentity]);
  return (
    <figure className={`console-evidence${compact ? " is-compact" : ""}`}>
      {src ? (
        <div ref={containerRef} className="console-evidence__image">
          <Image key={`${mediaIdentity}:${retryKey}`} src={src} alt={`${incidentNo?`${incidentNo} `:""}${objectName} ${annotated?"탐지 결과":"원본"} 이미지`} fill loading="eager" draggable={false} sizes="(max-width: 1024px) 100vw, 70vw" onLoad={event => {onImageLoad(event.currentTarget);setImageState("ready")}} onError={()=>setImageState("error")} />
          {imageState==="loading"&&<span className="evidence-image-state" role="status">이미지를 불러오는 중입니다.</span>}
          {imageState==="error"&&<span className="evidence-image-state is-error" role="alert">선택한 근거의 이미지를 불러올 수 없습니다.<button type="button" onClick={()=>{setImageState("loading");setRetryKey(value=>value+1)}}>다시 시도</button></span>}
          {projectedBbox && <DetectionOverlay variant="tracking" visualVariant={visualVariant} objectType={evidence.object_category} label={objectName} confidence={confidence} bbox={projectedBbox} animated={false}/>}
        </div>
      ) : <p className="console-empty">표시할 탐지 이미지가 없습니다.</p>}
    </figure>
  );
}

export function EvidenceCompareViewer({ evidence,incidentNo }: { evidence: IncidentEvidence;incidentNo?:string }) {
  const src = evidence.original_image_url;
  const mediaIdentity = `${evidence.detection_public_id}:compare:${src ?? "no-image"}`;
  const comparableBbox = canCompareEvidence(evidence) && src ? getEvidenceOverlayBbox(evidence, "compare") : null;
  const { containerRef, onImageLoad, projectedBbox } = useContainedBbox(comparableBbox, mediaIdentity);
  if (!canCompareEvidence(evidence) || !src || !evidence.bbox) return <p className="compare-unavailable">동일한 원본 프레임과 탐지 좌표가 없어 비교할 수 없습니다.</p>;
  const objectName = evidence.class_name ?? "탐지 객체";
  const confidence = evidence.confidence === null ? null : Math.round(evidence.confidence * 100);
  const visualVariant = getDetectionVisualVariant({objectCategory:evidence.object_category,classCode:evidence.class_code});
  return <figure className="compare-viewer">
    <div className="compare-grid">
      <section className="compare-pane"><strong>원본</strong><div className="compare-media"><Image key={`${mediaIdentity}:original`} src={src} alt={`${incidentNo?`${incidentNo} `:""}${objectName} 원본 이미지`} fill loading="eager" draggable={false} sizes="(max-width: 767px) 100vw, 35vw" /></div></section>
      <section className="compare-pane"><strong>탐지 결과</strong><div ref={containerRef} className="compare-media"><Image key={`${mediaIdentity}:result`} src={src} alt={`${incidentNo?`${incidentNo} `:""}${objectName} 탐지 결과 이미지`} fill loading="eager" draggable={false} sizes="(max-width: 767px) 100vw, 35vw" onLoad={event => onImageLoad(event.currentTarget)} />{projectedBbox && <DetectionOverlay variant="tracking" visualVariant={visualVariant} objectType={evidence.object_category} label={objectName} confidence={confidence} bbox={projectedBbox} animated={false}/>}</div></section>
    </div>
    <figcaption>{evidenceTime(evidence.detected_at)} KST · 동일 CCTV·촬영 시각·원본 프레임 비교</figcaption>
  </figure>;
}

function ChevronIcon() {
  return <svg className="disclosure-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

function SquarePenIcon(){
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M17.5 2.5a2.12 2.12 0 0 1 3 3L12 14l-4 1 1-4Z"/></svg>;
}

export function AssignmentSuccessNotice({onClose}:{onClose:()=>void}){
  return <div className="assignment-success" role="status" aria-live="polite"><span aria-hidden="true">✓</span><div><strong>내 담당 사건으로 지정되었습니다.</strong><p>이제 사건 검토를 시작할 수 있습니다.</p></div><button type="button" aria-label="담당 지정 성공 안내 닫기" onClick={onClose}>×</button></div>;
}

function CloseRecordIcon(){
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>;
}

export function MemoEntryBar({buttonRef,onOpen}:{buttonRef?:Ref<HTMLButtonElement>;onOpen:()=>void}){
  return <button ref={buttonRef} className="memo-entry" type="button" aria-label="관제 메모 작성" onClick={onOpen}><span>새로운 판단 근거나 전달 사항을 기록하세요</span><strong><SquarePenIcon/>메모 작성</strong></button>;
}

function evidenceReasonValue(code:string,evidence:IncidentEvidence){
  if(code==="CONFIDENCE_THRESHOLD")return evidenceConfidence(evidence.confidence);
  if(code==="DURATION_THRESHOLD")return `${(evidence.risk.duration_ms/1000).toFixed(1)}초`;
  if(code==="REPEAT_DETECTION")return `${evidence.risk.repeat_count}회`;
  if(code==="TRACK_STABLE")return evidence.risk.track_id;
  return null;
}

export function RiskCandidateSummary({ evidence }: { evidence: IncidentEvidence }) {
  const [expanded, setExpanded] = useState(false);
  const confidence = evidenceConfidence(evidence.confidence) ?? "정보 없음";
  const reasonCount = evidence.risk.reason_codes.length;
  const reasonHeading = reasonCount ? `판단 근거 ${reasonCount}건` : "판단 근거 없음";
  return (
    <section className="risk-summary">
      <header>
        <div><span>SELECTED EVIDENCE</span><h3>선택 근거 분석</h3></div>
      </header>
      <p><strong>현재 사건 근거 · {evidence.class_name ?? "탐지 객체"}</strong></p>
      <p className="risk-summary__headline">대표 신뢰도 {confidence} · 위험 점수 {evidence.risk.risk_score} · {formatRiskGrade(evidence.risk.risk_grade)}</p>
      <dl>
        <div><dt>신뢰도</dt><dd>{confidence}</dd></div><div><dt>위험 점수</dt><dd>{evidence.risk.risk_score} <small>/ 100</small></dd></div>
        <div><dt>위험 등급</dt><dd data-risk-grade={evidence.risk.risk_grade}>{formatRiskGrade(evidence.risk.risk_grade)}</dd></div><div><dt>지속시간</dt><dd>{(evidence.risk.duration_ms / 1000).toFixed(1)}초</dd></div>
        <div><dt>반복 탐지</dt><dd>{evidence.risk.repeat_count}회</dd></div><div><dt>추적 객체</dt><dd>{evidence.risk.track_id ?? "정보 없음"}</dd></div>
      </dl>
      <h4 className="risk-summary__reason-title">{reasonHeading}</h4>
      <button className="risk-summary__reason-header" type="button" aria-expanded={expanded} aria-controls="selected-evidence-reasons" aria-label={expanded ? "판단 근거 접기" : "판단 근거 펼치기"} onClick={() => setExpanded(value => !value)}>
        <span>{reasonHeading}</span><ChevronIcon />
      </button>
      <div id="selected-evidence-reasons" className={`risk-summary__reasons${expanded ? " is-expanded" : ""}`}>{reasonCount ? evidence.risk.reason_codes.map(code => {
        const value=evidenceReasonValue(code,evidence);
        return <article key={code}><i aria-hidden="true">✓</i><div><strong>{reasonLabel[code] ?? code}</strong>{value&&<b>{value}</b>}</div></article>;
      }) : <p>제공된 상세 분석 근거가 없습니다.</p>}</div>
      <p className="risk-summary__notice"><span aria-hidden="true">i</span><span>AI 분석 결과는 관제 판단을 돕기 위한 참고 정보입니다.<br/>실제 위험 여부와 출동 필요 여부는 관제자가 최종 결정합니다.</span></p>
    </section>
  );
}

type MemoFilter="ALL"|IncidentMemoType;
const memoFilters:MemoFilter[]=["ALL","GENERAL","REVIEW","DISPATCH","CLOSURE"];
const memoFilterLabel:Record<MemoFilter,string>={ALL:"전체",...memoTypeLabel};
export function IncidentMemoLog({memos,userPublicId,canManage=false,onEdit,onDelete}:{memos:IncidentMemo[];userPublicId?:string;canManage?:boolean|((memo:IncidentMemo)=>boolean);onEdit?:(memo:IncidentMemo)=>void;onDelete?:(memo:IncidentMemo)=>void}){
  const[memoFilter,setMemoFilter]=useState<MemoFilter>("ALL");
  const[menuOpen,setMenuOpen]=useState("");
  const sortedMemos=useMemo(()=>sortIncidentMemos(memos),[memos]);
  const activeMemos=useMemo(()=>sortedMemos.filter(memo=>!memo.deleted_at),[sortedMemos]);
  const latestMemoId=activeMemos[0]?.public_id;
  const memoCounts=useMemo(()=>Object.fromEntries(memoFilters.map(filter=>[filter,filter==="ALL"?activeMemos.length:activeMemos.filter(memo=>normalizeMemoType(memo.memo_type)===filter).length])) as Record<MemoFilter,number>,[activeMemos]);
  const visibleMemos=useMemo(()=>memoFilter==="ALL"?sortedMemos:sortedMemos.filter(memo=>normalizeMemoType(memo.memo_type)===memoFilter),[memoFilter,sortedMemos]);
  if(!memos.length)return <div className="memo-empty"><strong>아직 등록된 관제 메모가 없습니다</strong><p>사건 판단 근거나 전달 사항을 기록해 주세요</p></div>;
  return <><nav className="memo-filters" aria-label="관제 메모 유형 필터">{memoFilters.map(filter=><button type="button" key={filter} aria-pressed={memoFilter===filter} onClick={()=>setMemoFilter(filter)}>{memoFilterLabel[filter]} <b>{memoCounts[filter]}</b></button>)}</nav>
    {visibleMemos.length?<div className="memo-list">{visibleMemos.map(memo=>{const type=normalizeMemoType(memo.memo_type),deleted=Boolean(memo.deleted_at),latest=!deleted&&memo.public_id===latestMemoId,manageable=typeof canManage==="function"?canManage(memo):canManage,own=manageable&&!deleted&&Boolean(userPublicId)&&memo.created_by.public_id===userPublicId;return <article key={memo.public_id} data-memo-type={type} data-deleted={deleted||undefined} className={latest?"is-latest":undefined}><i aria-hidden="true"/><div><header><div><b>{deleted?"삭제된 메모":memoTypeLabel[type]}</b>{latest&&<span className="memo-latest"><i aria-hidden="true"/>최근 메모</span>}</div>{own&&<div className="memo-actions"><button type="button" aria-label={`${memoTypeLabel[type]} 메모 메뉴`} aria-expanded={menuOpen===memo.public_id} onClick={()=>setMenuOpen(value=>value===memo.public_id?"":memo.public_id)}>⋯</button>{menuOpen===memo.public_id&&<div role="menu"><button type="button" role="menuitem" onClick={()=>{setMenuOpen("");onEdit?.(memo)}}>메모 정정</button><button type="button" role="menuitem" className="is-danger" onClick={()=>{setMenuOpen("");onDelete?.(memo)}}>메모 삭제</button></div>}</div>}</header><TimelineDetail id={`memo-${memo.public_id}`} type="메모" detail={deleted?"삭제된 메모입니다":memo.content}/><small>{deleted?<>{memo.deleted_by?.user_name??"사용자"} · <time>{formatKst(memo.deleted_at!)} KST</time></>:<>{memo.created_by.user_name} · <time>{formatKst(memo.created_at)} KST</time>{memo.updated_at?" · 수정됨":""}</>}</small></div></article>})}</div>:<div className="memo-empty"><strong>해당 유형의 관제 메모가 없습니다</strong></div>}
  </>;
}

export function WorkStageNavigator({record,selected,onSelect,onReturn}:{record:IncidentDetailRecord;selected:IncidentWorkStage|null;onSelect:(stage:IncidentWorkStage)=>void;onReturn:()=>void}){
  const stages=useMemo(()=>getIncidentWorkStages(record),[record]);
  const current=currentIncidentWorkStage(stages);
  const currentIndex=current?stages.findIndex(stage=>stage===current):-1;
  const completionTitle=record.incident.status==="FALSE_POSITIVE"?"오탐 판정 완료":"사건 처리 완료";
  if(selected)return <section className="work-stage-record" aria-label={`${selected.label} 완료 기록`}>
    <header className="work-stage-record__header"><div className="work-stage-record__heading"><span>완료 단계 기록</span><h3>{selected.label} 완료</h3></div><button className="work-stage-record__close" type="button" aria-label="완료 기록 상세 닫기" onClick={onReturn}><CloseRecordIcon/><span>기록 닫기</span></button></header>
    {selected.history?<dl><div><dt>처리 내용</dt><dd>{selected.history.label}</dd></div><div><dt>처리자</dt><dd>{selected.history.actor_name??"시스템"}</dd></div><div><dt>처리 시각</dt><dd>{formatKst(selected.history.occurred_at)} KST</dd></div>{selected.history.detail&&<div><dt>상세</dt><dd>{selected.history.detail}</dd></div>}</dl>:<p>완료된 단계입니다. 별도의 상세 처리 기록은 제공되지 않았습니다.</p>}
  </section>;
  return <section className="work-stage-navigation" aria-label="사건 업무 단계">
    <header><h3>업무 진행</h3><b>{current?`현재 단계 ${currentIndex+1} / ${stages.length}`:"업무 완료"}</b></header>
    <ol>{stages.map((stage,index)=>{const stateLabel=stage.state==="done"?"완료":stage.state==="current"?"현재":stage.state==="skipped"?"해당 없음":"대기";const tooltip=`${index+1}. ${stage.label} · ${stateLabel}`;return <li key={stage.id} data-state={stage.state}>
      {stage.state==="done"?<button className="work-stage-node" type="button" aria-label={`${tooltip} · 완료 기록 보기`} data-tooltip={tooltip} onClick={()=>onSelect(stage)}><i aria-hidden="true">✓</i></button>:<span className="work-stage-node" tabIndex={0} aria-label={tooltip} aria-current={stage.state==="current"?"step":undefined} data-tooltip={tooltip}><i aria-hidden="true">{stage.state==="skipped"?"−":index+1}</i></span>}
    </li>})}</ol>
    <div className="work-stage-current"><span>{current?"현재 단계":"업무 완료"}</span><strong>{current?.actionLabel??completionTitle}</strong><p>{incidentWorkStageFlow(stages)}</p></div>
  </section>;
}

export function TimelineDetail({id,type,detail}:{id:string;type:"사건"|"메모"|"출동";detail:string|null}){
  const[expanded,setExpanded]=useState(false);
  if(!detail)return null;
  const expandable=type==="메모"&&detail.length>100;
  return <div className={`timeline-detail${type==="메모"?" is-memo":""}`}><p id={`${id}-detail`} className={!expanded&&expandable?"is-collapsed":undefined}>{detail}</p>{expandable&&<button type="button" aria-expanded={expanded} aria-controls={`${id}-detail`} onClick={()=>setExpanded(value=>!value)}>{expanded?"접기":"더 보기"}</button>}</div>;
}

type MemoCapabilities={write:boolean;mutation:boolean};

export function DetailTabs({record,user,currentTask,onMemoChanged,onRefresh,onNotify,memoCapabilities={write:adapter.supportsMemoWrite,mutation:adapter.supportsMemoMutation}}:{record:IncidentDetailRecord;user:AuthenticatedUser|null;currentTask?:ReactNode;onMemoChanged:(memo:IncidentMemo)=>void;onRefresh:()=>Promise<boolean>;onNotify:(message:string)=>void;memoCapabilities?:MemoCapabilities}){
  const activeMemoCount=record.memos.filter(memo=>!memo.deleted_at).length;
  const tabs = useMemo(() => [
    { key: "task", label: "업무 진행", count: null },
    { key: "history", label: "전체 기록", count: buildIncidentTimeline(record).length },
  ], [record]);
  const [active, setActive] = useState(tabs[0]?.key ?? "task");
  const [memoOpen,setMemoOpen]=useState(false),[editingMemo,setEditingMemo]=useState<IncidentMemo|null>(null),[deletingMemo,setDeletingMemo]=useState<IncidentMemo|null>(null),[deleteReason,setDeleteReason]=useState(""),[memoError,setMemoError]=useState(""),[memoBusy,setMemoBusy]=useState(false);
  const[selectedStage,setSelectedStage]=useState<IncidentWorkStage|null>(null),[historyFilter,setHistoryFilter]=useState<"ALL"|"사건"|"메모"|"출동">("ALL");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const memoTriggerRef=useRef<HTMLButtonElement>(null),memoBusyRef=useRef(false);
  const policyAvailability=user?resolveMemoAvailability(record.incident,{public_id:user.publicId??"",permissions:user.apiPermissions}):{allowed:false,reason:"사용자 정보를 확인한 뒤 메모를 작성할 수 있습니다"};
  const availability=memoCapabilities.write?policyAvailability:{allowed:false,reason:"저장된 관제 메모는 현재 사건 기록에서 확인할 수 없습니다"};
  const canManageMemo=(memo:IncidentMemo)=>Boolean(user)&&canMutateIncidentMemo(record.incident,memo,{public_id:user?.publicId??"",permissions:user?.apiPermissions??[]},memoCapabilities.mutation);
  useEffect(() => { if (!tabs.some(tab => tab.key === active)) setActive(tabs[0]?.key ?? "task"); }, [active, tabs]);
  const closeSelectedStage=useCallback(()=>{
    setSelectedStage(null);
    setActive("task");
    tabRefs.current[0]?.focus();
  },[]);
  useEffect(()=>{
    if(!selectedStage)return;
    const closeOnEscape=(event:KeyboardEvent)=>{
      if(event.key!=="Escape"||event.defaultPrevented)return;
      const target=event.target;
      if(target instanceof Element&&target.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu], [role=listbox]"))return;
      if(document.querySelector("[role=dialog][aria-modal=true]"))return;
      event.preventDefault();
      closeSelectedStage();
    };
    window.addEventListener("keydown",closeOnEscape);
    return()=>window.removeEventListener("keydown",closeOnEscape);
  },[closeSelectedStage,selectedStage]);
  const move = (index: number, direction: number) => { const next = (index + direction + tabs.length) % tabs.length; setActive(tabs[next].key); tabRefs.current[next]?.focus(); };
  const timeline=useMemo(()=>buildIncidentTimeline(record),[record]);
  const latestTimelineId=timeline[0]?.id;
  const visibleTimeline=useMemo(()=>historyFilter==="ALL"?timeline:timeline.filter(item=>item.type===historyFilter),[historyFilter,timeline]);
  const recentMemo=useMemo(()=>sortIncidentMemos(record.memos.filter(memo=>!memo.deleted_at))[0],[record.memos]);
  const closeMemo=()=>{if(memoBusy)return;setMemoOpen(false);setEditingMemo(null);setMemoError("");window.requestAnimationFrame(()=>memoTriggerRef.current?.focus())};
  const openNewMemo=()=>{setEditingMemo(null);setMemoError("");setMemoOpen(true)};
  const openEditMemo=(memo:IncidentMemo)=>{setEditingMemo(memo);setMemoError("");setMemoOpen(true)};
  const saveMemo=async(memoType:IncidentMemoType,content:string)=>{const payloadContent=memoType==="GENERAL"?content:content.trim();if(!user){setMemoError("사용자 정보를 확인한 뒤 다시 시도해 주세요");return}if(!payloadContent.trim()){setMemoError("메모 내용을 입력해 주세요");return}if(payloadContent.length>2000){setMemoError("메모는 2,000자 이내로 입력해 주세요");return}if(memoBusyRef.current)return;memoBusyRef.current=true;setMemoBusy(true);setMemoError("");try{const request={incident_public_id:record.incident.public_id,memo_type:memoType,content:payloadContent,actor_public_id:user.publicId??"",actor_name:user.name};const memo=editingMemo?await adapter.updateMemo({...request,memo_public_id:editingMemo.public_id,actor_permissions:user.apiPermissions}):await adapter.createMemo(request);onMemoChanged(memo);if(!editingMemo)clearIncidentMemoDraft(record.incident.public_id);setMemoOpen(false);setEditingMemo(null);onNotify(editingMemo?"관제 메모가 정정되었습니다":"관제 메모가 등록되었습니다");window.requestAnimationFrame(()=>memoTriggerRef.current?.focus())}catch(error){if(error instanceof ApiError&&["AUTH_PERMISSION_DENIED","INCIDENT_NOT_ASSIGNED_CONTROLLER"].includes(error.code)){setMemoError("메모를 변경할 권한이 없습니다");await onRefresh()}else if(error instanceof ApiError&&error.code==="INCIDENT_NOT_FOUND")setMemoError("사건 정보를 찾을 수 없습니다");else if(error instanceof ApiError&&error.code==="COMMON_VALIDATION_ERROR")setMemoError("메모 내용을 확인해 주세요");else setMemoError("메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요")}finally{memoBusyRef.current=false;setMemoBusy(false)}};
  const deleteMemo=async()=>{if(!user||!deletingMemo||!deleteReason.trim()||memoBusyRef.current)return;memoBusyRef.current=true;setMemoBusy(true);try{const memo=await adapter.deleteMemo({incident_public_id:record.incident.public_id,memo_public_id:deletingMemo.public_id,reason:deleteReason.trim(),actor_public_id:user.publicId??"",actor_name:user.name,actor_permissions:user.apiPermissions});onMemoChanged(memo);setDeletingMemo(null);setDeleteReason("");onNotify("관제 메모가 삭제되었습니다")}catch{setMemoError("메모를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요")}finally{memoBusyRef.current=false;setMemoBusy(false)}};
  return <section className="detail-tabs incident-workspace"><header className="incident-workspace__heading"><span>INCIDENT WORKSPACE</span><h2>사건 업무</h2></header><div className="detail-tabs__bar"><div className="detail-tabs__list" role="tablist" aria-label="사건 업무">{tabs.map((tab, index) => { const selected = active === tab.key; return <button id={`incident-workspace-tab-${tab.key}`} key={tab.key} ref={node => { tabRefs.current[index] = node; }} role="tab" tabIndex={selected ? 0 : -1} aria-selected={selected} aria-controls={`incident-workspace-panel-${tab.key}`} onClick={() => {setActive(tab.key);setSelectedStage(null)}} onKeyDown={event => { if (event.key === "ArrowRight") { event.preventDefault(); setSelectedStage(null);move(index, 1); } if (event.key === "ArrowLeft") { event.preventDefault();setSelectedStage(null); move(index, -1); } }}>{tab.label}{tab.count!==null&&<b aria-label={`${tab.count}건`}>{tab.count}</b>}</button>; })}</div></div>
    <div id={`incident-workspace-panel-${active}`} className="detail-tabs__panel incident-workspace__content" role="tabpanel" tabIndex={0} aria-labelledby={`incident-workspace-tab-${active}`}>
      {active === "task" && <div className="incident-workspace__task"><WorkStageNavigator record={record} selected={selectedStage} onSelect={setSelectedStage} onReturn={closeSelectedStage}/>{!selectedStage&&<>{currentTask}{availability.allowed&&<button ref={memoTriggerRef} type="button" className="workspace-review-memo" onClick={openNewMemo}>판단 근거 메모</button>}<section className="workspace-recent-memo"><header><strong>최근 메모</strong>{activeMemoCount>0&&<button type="button" onClick={()=>{setHistoryFilter("메모");setActive("history")}}>전체 메모 보기</button>}</header>{recentMemo?<><b>{memoTypeLabel[normalizeMemoType(recentMemo.memo_type)]}</b><p>{recentMemo.content}</p><small>{recentMemo.created_by.user_name} · {formatKst(recentMemo.created_at)} KST</small></>:<p>아직 등록된 관제 메모가 없습니다.</p>}</section></>}</div>}
      {active === "history" && <div className="workspace-history"><div className="workspace-history-toolbar"><nav className="workspace-history-filters" aria-label="전체 기록 유형 필터">{(["ALL","사건","메모","출동"] as const).map(filter=><button type="button" key={filter} aria-pressed={historyFilter===filter} onClick={()=>setHistoryFilter(filter)}>{filter==="ALL"?"전체":filter}</button>)}</nav><span>정렬 <b>최신순</b></span></div>{historyFilter==="메모"?<IncidentMemoLog memos={record.memos} userPublicId={user?.publicId} canManage={canManageMemo} onEdit={openEditMemo} onDelete={memo=>{setDeletingMemo(memo);setDeleteReason("");setMemoError("")}}/>:<>{record.dispatch&&historyFilter!=="사건"&&<dl className="workspace-dispatch-summary"><div><dt>출동 담당자</dt><dd>{record.dispatch.responder_label}</dd></div><div><dt>현재 출동 상태</dt><dd>{dispatchStatusLabel[record.dispatch.status]}</dd></div></dl>}{visibleTimeline.length?<ol className="activity-list" aria-label="최신순 사건 업무 기록">{visibleTimeline.map(item => <li key={item.id} className={item.id===latestTimelineId?"is-latest":""} data-type={item.type}><i aria-hidden="true"/><div><header><strong>{item.title}</strong><b data-type={item.type}>{item.type}</b></header><span>{item.actor} · <time dateTime={item.occurredAt}>{formatKst(item.occurredAt)} KST</time></span><TimelineDetail id={item.id.replaceAll(":","-")} type={item.type} detail={item.detail}/></div></li>)}</ol>:<p className="drawer-empty">{timeline.length?"선택한 유형의 기록이 없습니다.":"아직 표시할 업무 기록이 없습니다."}</p>}</>}</div>}
    </div>
    {memoOpen&&<IncidentMemoComposer incidentPublicId={record.incident.public_id} memos={record.memos} editingMemo={editingMemo} initialType="REVIEW" busy={memoBusy} error={memoError} onSubmit={(type,content)=>void saveMemo(type,content)} onClose={closeMemo}/>}
    {deletingMemo&&<div className="memo-dialog-backdrop" onMouseDown={event=>event.target===event.currentTarget&&!memoBusy&&setDeletingMemo(null)}><section className="memo-dialog memo-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="memo-delete-title"><header><div><h2 id="memo-delete-title">메모 삭제</h2><p>이 메모를 기록에서 숨깁니다. 삭제 후에도 업무 이력을 위해 삭제 정보는 보존됩니다.</p></div><button type="button" aria-label="메모 삭제 창 닫기" disabled={memoBusy} onClick={()=>setDeletingMemo(null)}>×</button></header><div className="memo-dialog__body"><label>삭제 사유<textarea value={deleteReason} maxLength={500} disabled={memoBusy} aria-invalid={Boolean(memoError)} aria-describedby="memo-delete-error memo-delete-count" onChange={event=>{setDeleteReason(event.target.value);setMemoError("")}}/></label><div className="memo-dialog__meta"><p id="memo-delete-error" role="alert">{memoError}</p><span id="memo-delete-count">{deleteReason.length} / 500</span></div></div><footer><button type="button" disabled={memoBusy} onClick={()=>setDeletingMemo(null)}>취소</button><button type="button" className="is-danger" disabled={memoBusy||!deleteReason.trim()} onClick={()=>void deleteMemo()}>{memoBusy?"삭제 중":"메모 삭제"}</button></footer></section></div>}
  </section>;
}

export function IncidentCommandWorkspace({ publicId, invalidIdentifier = false }: { publicId: string; invalidIdentifier?: boolean }) {
  const { user } = useAuth();
  const searchParams=useSearchParams();
  const requestedReturnTo=searchParams.get("return_to");
  const incidentListHref=requestedReturnTo?.startsWith("/control/incidents")?requestedReturnTo:"/control/incidents";
  const [record, setRecord] = useState<IncidentDetailRecord | null>(null);
  const [loading, setLoading] = useState(!invalidIdentifier), [missing, setMissing] = useState(false), [error, setError] = useState("");
  const [view, setView] = useState<EvidenceViewMode>("annotated"), [selectedEvidence, setSelectedEvidence] = useState("");
  const [focusOpen,setFocusOpen]=useState(false);
  const [dialog, setDialog] = useState<"decision" | "dispatch" | "close" | null>(null), [busy, setBusy] = useState(false), [toast, setToast] = useState(""),[toastSuccess,setToastSuccess]=useState(false);
  const [claimNotice,setClaimNotice]=useState(false),[claimButtonSuccess,setClaimButtonSuccess]=useState(false);
  const [refreshing,setRefreshing]=useState(false),[syncMessage,setSyncMessage]=useState("");
  const busyRef = useRef(false),refreshingRef=useRef(false);
  const focusTriggerRef=useRef<HTMLButtonElement>(null),focusPushedRef=useRef(false),wasFocusOpenRef=useRef(false);
  const closureTriggerRef=useRef<HTMLButtonElement>(null);
  const applyRecord=useCallback((next:IncidentDetailRecord)=>{setRecord(next);setMissing(false);setSelectedEvidence(current=>resolveEvidenceSelection(current,next));},[]);
  const load = useCallback(async () => { if (invalidIdentifier) return false; setLoading(true); setError(""); try { const next = await adapter.get(publicId); if (!next) { setMissing(true); return false; } applyRecord(next); return true; } catch { setError("사건 상세 정보를 불러오지 못했습니다."); return false; } finally { setLoading(false); } }, [applyRecord,invalidIdentifier, publicId]);
  const refreshManually=useCallback(async()=>{if(refreshingRef.current||!record)return;refreshingRef.current=true;setRefreshing(true);setSyncMessage("");try{const next=await adapter.get(publicId);if(!next)throw new Error("INCIDENT_NOT_FOUND");const changed=getIncidentRefreshChanges(record,next);applyRecord(next);const checked=evidenceTime(new Date().toISOString());setSyncMessage(changed.length?`사건 상태를 최신 정보로 갱신했습니다 · ${checked} 기준`:`현재 최신 상태입니다 · ${checked} 확인`);}catch{setSyncMessage("최신 상태를 확인하지 못했습니다 · 잠시 후 다시 시도해 주세요");}finally{refreshingRef.current=false;setRefreshing(false)}},[applyRecord,publicId,record]);
  const evidences = useMemo(() => dedupeEvidences(record?.evidences ?? []), [record]);
  useEffect(() => { void load(); }, [load]);
  useEffect(()=>{
    const syncFocus=()=>{
      const focus=readEvidenceFocus(window.location.search);
      if(focus.open){
        if(focus.evidenceId&&evidences.some(item=>item.detection_public_id===focus.evidenceId))setSelectedEvidence(focus.evidenceId);
        if(focus.mode)setView(focus.mode);
      }
      setFocusOpen(focus.open);
    };
    syncFocus();window.addEventListener("popstate",syncFocus);return()=>window.removeEventListener("popstate",syncFocus);
  },[evidences]);
  useEffect(()=>{
    if(wasFocusOpenRef.current&&!focusOpen)window.requestAnimationFrame(()=>focusTriggerRef.current?.focus());
    wasFocusOpenRef.current=focusOpen;
  },[focusOpen]);
  useEffect(() => { if (!toast) return; const timer=window.setTimeout(() => setToast(""), 4500); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(()=>{if(!claimButtonSuccess)return;const timer=window.setTimeout(()=>setClaimButtonSuccess(false),1000);return()=>window.clearTimeout(timer)},[claimButtonSuccess]);
  useEffect(()=>{if(!claimNotice)return;const timer=window.setTimeout(()=>setClaimNotice(false),4500);return()=>window.clearTimeout(timer)},[claimNotice]);
  const evidence = evidences.find(item => item.detection_public_id === selectedEvidence) ?? evidences[0];
  const mode = record ? resolveIncidentWorkspaceMode(record.incident.status) : null;
  const primary = useMemo(() => { const candidate = record && user ? resolvePrimaryIncidentAction(record.incident, { public_id: user.publicId ?? "", permissions: user.apiPermissions, roles:user.roles }) : null; if (candidate?.key === "assign" && record?.dispatch) return null; if (candidate && ["view_dispatch", "view_field"].includes(candidate.key)) return null; return candidate && !isIncidentActionSupported(adapter.mode,candidate.key) ? null : candidate; }, [record, user]);
  const openFocus=()=>{if(!evidence)return;window.history.pushState({roadbogoEvidenceFocus:true},"",evidenceFocusUrl(window.location.pathname,window.location.search,evidence.detection_public_id,view));focusPushedRef.current=true;setFocusOpen(true)};
  const closeFocus=()=>{if(readEvidenceFocus(window.location.search).open&&focusPushedRef.current){focusPushedRef.current=false;window.history.back();return}window.history.replaceState(null,"",incidentDetailUrl(window.location.pathname,window.location.search));setFocusOpen(false);window.requestAnimationFrame(()=>focusTriggerRef.current?.focus())};
  const updateFocusSelection=(publicId:string)=>{setSelectedEvidence(publicId);if(readEvidenceFocus(window.location.search).open)window.history.replaceState(window.history.state,"",evidenceFocusSelectionUrl(window.location.pathname,window.location.search,publicId))};
  const updateFocusView=(next:EvidenceViewMode)=>{setView(next);if(readEvidenceFocus(window.location.search).open)window.history.replaceState(window.history.state,"",evidenceFocusModeUrl(window.location.pathname,window.location.search,next))};

  const perform = async (action: IncidentCommandAction, payload?: IncidentDecisionPayload | IncidentClosePayload | { responder_public_id: string; request_message: string }) => {
    if (!record || busyRef.current) return; busyRef.current = true; setBusy(true); const idempotencyKey = createIdempotencyKey();
    try {
      const result = action === "assign" && payload && "responder_public_id" in payload
        ? await adapter.assignDispatch({ incident_public_id: record.incident.public_id, responder_public_id: payload.responder_public_id, request_message: payload.request_message.trim() || null, expected_version_no: record.incident.version_no, idempotency_key: idempotencyKey })
        : await adapter.act({ incident_public_id: record.incident.public_id, expected_version_no: record.incident.version_no, action, idempotency_key: idempotencyKey, payload: payload ?? (action === "close" ? {closure_note:"현장 조치 완료 상태를 확인하고 사건을 종료합니다."} : action === "claim" || action === "release" ? { actor_public_id: user?.publicId ?? "", actor_name: user?.name ?? "관제 담당자" } : undefined) });
      if (result.ok) { setRecord(current => current ? { ...current, incident: { ...current.incident, status: result.status, version_no: result.version_no } } : current); const latest = result.record ?? await adapter.get(record.incident.public_id); if (latest) applyRecord(latest); const claimConfirmed=action==="claim"&&latest?.incident.status==="CLAIMED"&&latest.incident.assigned_controller?.public_id===user?.publicId;if(claimConfirmed){setToast("");setClaimNotice(true);setClaimButtonSuccess(true)}else{if(action==="release"){setClaimNotice(false);setClaimButtonSuccess(false)}const successMessage:Partial<Record<IncidentCommandAction,string>>={acknowledge:"사건을 확인했습니다.",release:"사건 담당이 해제되었습니다.",review:"사건 검토를 시작했습니다.",decide:"위험 판정을 반영했습니다.",assign:"출동 담당자를 배정했습니다.",close:"사건 종료를 확인했습니다."};setToastSuccess(true);setToast(successMessage[action]??"사건 처리를 완료했습니다.")} setDialog(null); }
      else { setRecord(result.latest); const messages: Record<string, string> = { INCIDENT_VERSION_CONFLICT: "사건 정보가 변경되었습니다. 최신 상태를 다시 확인해 주세요.", INCIDENT_ALREADY_CLAIMED: `다른 관제자가 먼저 담당자로 지정되었습니다.${result.controller_name ? ` 담당자: ${result.controller_name}` : ""}`, INCIDENT_NOT_ASSIGNED_CONTROLLER: "현재 담당 관제자만 사건 검토를 시작할 수 있습니다.", INCIDENT_INVALID_STATE_TRANSITION: "현재 사건 상태에서는 이 작업을 수행할 수 없습니다.", DISPATCH_RESPONDER_NOT_FOUND: "출동 담당자를 찾을 수 없습니다.", DISPATCH_RESPONDER_UNAVAILABLE: "선택한 담당자는 현재 출동할 수 없습니다.", DISPATCH_RESPONDER_BUSY: "선택한 담당자가 다른 출동을 진행 중입니다.", DISPATCH_ALREADY_ASSIGNED: "이 사건에는 이미 활성 출동이 있습니다.", DISPATCH_IDEMPOTENCY_CONFLICT: "동일 멱등 키로 다른 출동 요청이 확인되었습니다.", INCIDENT_CLAIM_CONFLICT: "다른 관제자가 먼저 담당자로 지정되었습니다.", FORBIDDEN: "현재 권한으로 이 작업을 수행할 수 없습니다.", INVALID_TRANSITION: "현재 사건 상태에서 이 작업을 수행할 수 없습니다." }; setToastSuccess(false);setToast(messages[result.code] ?? "요청을 처리하지 못했습니다."); }
    } catch(error) { setToastSuccess(false);setToast(error instanceof ApiError&&error.message?error.message:"요청을 처리하지 못했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요."); } finally { busyRef.current = false; setBusy(false); }
  };

  if (invalidIdentifier) return <StatePage title="사건 주소를 확인해 주세요" body="올바르지 않거나 더 이상 사용할 수 없는 사건 주소입니다." />;
  if (loading && !record) return <><LandingHeader showSections={false} /><main className="incident-state" role="status">사건 상세 정보를 불러오고 있습니다.</main></>;
  if (missing) return <StatePage title="사건을 찾을 수 없습니다" body="삭제되었거나 접근할 수 없는 사건입니다." />;
  if (error || !record) return <><LandingHeader showSections={false} /><main className="incident-state"><p>{error}</p><button onClick={() => void load()}>다시 시도</button></main></>;

  const { incident, cctv } = record;
  const awaitingController=primary?.key==="claim"&&!incident.assigned_controller;
  return <div className="incident-page"><LandingHeader showSections={false} />{toast && <div className={`incident-toast${toastSuccess?" is-success":""}`} role="status">{toast}<button aria-label="안내 닫기" onClick={() => setToast("")}>×</button></div>}
    <main className="incident-shell incident-console">
      <section className="console-status">
        <div className={`console-status__top ${adapter.mode==="mock"?"is-mock":""}`}><span className="console-status__kicker">사건 상세</span><div className="console-status__utilities">{adapter.mode==="mock"&&<div className="console-demo-tools"><strong><i aria-hidden="true"/>시연 모드</strong><span>최근 반영 <time>{formatKst(incident.updated_at).split(" ").at(-1)}</time></span><button className="console-refresh" type="button" disabled={refreshing} aria-busy={refreshing} aria-label="시연 상태 새로고침" title="시연 상태 새로고침" data-tooltip="시연 상태 새로고침" onClick={() => void refreshManually()}><svg className={refreshing?"is-spinning":undefined} aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"/></svg></button></div>}<Link className="incident-list-link" href={incidentListHref} aria-label="사건 목록"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg><span>사건 목록</span></Link></div></div>
        <div className="console-status__identity"><div><h1>{incident.incident_no}</h1><p className="console-object"><strong>{incident.class_name ?? objectCategoryLabel[incident.object_category]}</strong></p></div><div className="console-badges"><b>{riskLabel[incident.current_risk_grade]} 위험</b><b>{incidentStatusLabel[incident.status]}</b><b>{incident.assigned_controller?.public_id === user?.publicId ? "내 담당" : incident.assigned_controller?.display_name ?? "담당 미지정"}</b></div></div>
        <dl className="console-facts"><div><dt>CCTV</dt><dd>{cctv.cctv_name}</dd></div><div><dt>도로</dt><dd>{cctv.road.road_name}</dd></div><div><dt>구간</dt><dd>{cctv.road_section.section_name}</dd></div><div><dt>방향</dt><dd>{directionLabel[cctv.direction_code]}</dd></div><div><dt>최초 시각</dt><dd>{formatKst(incident.created_at)} KST</dd></div><div><dt>최근 탐지</dt><dd>{formatKst(evidences.at(-1)?.detected_at ?? incident.updated_at)} KST</dd></div><div><dt>탐지 횟수</dt><dd>{incident.detection_count}회 · {elapsedLabel(incident.created_at)}</dd></div></dl>
        <p className="console-sync-message" role="status" aria-live="polite">{syncMessage}</p>
      </section>
      <div className="console-layout">
        <div className="incident-evidence-column">
          <section className="evidence-console"><header><span>EVIDENCE REVIEW</span><h2>AI 증거 검토</h2><p>AI 오버레이와 원본 프레임을 확인해 사건 근거를 검토합니다.</p></header>{evidence ? <><div className="evidence-tabs" role="tablist" aria-label="증거 보기 옵션">{evidenceViewOptions.map(({value:key,label}) => <button key={key} className={key === "compare" ? "is-compare-option" : undefined} role="tab" aria-selected={view === key} onClick={() => setView(key)}>{key === "compare" && <span aria-hidden="true">◫</span>}{label}</button>)}</div><div className="evidence-toolbar"><span><strong>현재 선택 근거 · {evidence.class_name ?? "분류 정보 없음"}</strong> · {evidenceTime(evidence.detected_at)} KST</span>{(evidence.annotated_image_url ?? evidence.original_image_url) && <button ref={focusTriggerRef} type="button" className="evidence-focus-trigger" aria-label="현재 증거 집중 검토" onClick={openFocus}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>집중 검토</button>}</div><div className={`console-evidence-view is-${view}`}>{view === "annotated" && <EvidenceFigure evidence={evidence} annotated />}{view === "original" && <EvidenceFigure evidence={evidence} annotated={false} />}{view === "compare" && <EvidenceCompareViewer evidence={evidence} />}</div><section className="evidence-strip"><header><h3>탐지 근거 {evidences.length}건</h3><span>시각과 신뢰도를 비교해 근거를 선택하세요.</span></header><div>{evidences.map((item,index) => { const thumbnail = item.annotated_image_url ?? item.original_image_url; const selected = item.detection_public_id === evidence.detection_public_id; return <button key={item.detection_public_id} className={selected ? "is-active" : ""} aria-pressed={selected} onClick={() => setSelectedEvidence(item.detection_public_id)} onKeyDown={event=>{if(event.key!=="ArrowRight"&&event.key!=="ArrowLeft")return;event.preventDefault();const next=evidences[(index+(event.key==="ArrowRight"?1:-1)+evidences.length)%evidences.length];setSelectedEvidence(next.detection_public_id);document.querySelector<HTMLButtonElement>(`[data-evidence-id="${next.detection_public_id}"]`)?.focus()}} data-evidence-id={item.detection_public_id}>{thumbnail && <span><Image src={thumbnail} alt="" fill sizes="78px" /></span>}<strong>{item.class_name ?? "분류 정보 없음"}</strong><time>{evidenceTime(item.detected_at)} KST</time><small>{item.confidence === null ? "신뢰도 정보 없음" : `신뢰도 ${Math.round(item.confidence * 100)}%`}</small><em>{item.is_representative ? "대표 근거" : selected ? "현재 선택" : "추가 근거"}</em></button>; })}</div></section></> : <p className="console-empty">제공된 탐지 근거가 없습니다.</p>}</section>
          {evidence && <RiskCandidateSummary evidence={evidence} />}
        </div>
        <aside className="incident-workspace-column">
          {claimNotice&&<AssignmentSuccessNotice onClose={()=>setClaimNotice(false)}/>}
          <DetailTabs record={record} user={user} onRefresh={load} onNotify={message=>{setToastSuccess(true);setToast(message)}} onMemoChanged={memo=>setRecord(current=>current?{...current,memos:[memo,...current.memos.filter(item=>item.public_id!==memo.public_id)]}:current)} currentTask={<>
          <section className="command-task-status" aria-label="담당 상태"><h3>담당 상태</h3><div className="command-badges"><b>{incidentStatusLabel[incident.status]}</b><b>{incident.assigned_controller?.public_id===user?.publicId?"내 담당":incident.assigned_controller?"담당 지정":"담당 미지정"}</b></div></section>
           {["ACTION_COMPLETED","CLOSED"].includes(incident.status)?<FieldActionReview record={record} busy={busy} closeButtonRef={closureTriggerRef} canClose={primary?.key==="close"} onClose={()=>setDialog("close")}/>:dialog?<ActionDialog type={dialog} record={record} evidence={evidence} busy={busy} embedded onClose={() => setDialog(null)} onConfirm={payload => void perform(dialog === "decision" ? "decide" : "assign", payload)} />:record.decision&&mode==="READ_ONLY"?<FinalDecisionSummary record={record}/>:<><div className="command-next"><span>{awaitingController?"담당 관제자":"관제자가 할 일"}</span><strong>{awaitingController?"담당자 미지정":primary?.label ?? (mode === "READ_ONLY" ? "처리 완료" : "현재 가능한 업무 없음")}</strong><p>{awaitingController?"아직 이 사건을 담당하는 관제자가 없습니다.":primary ? actionDescription[primary.key] : mode === "READ_ONLY" ? "최종 처리된 사건입니다." : "현재 계정에는 이 단계의 사건 처리 권한이 없거나 아직 지원되지 않는 업무입니다."}</p></div>{claimButtonSuccess?<button className="incident-primary is-assignment-success" type="button" disabled><span aria-hidden="true">✓</span>내 담당으로 지정됨</button>:primary && <button className="incident-primary" disabled={busy} aria-busy={busy} onClick={() => primary.key === "decide" ? setDialog("decision") : primary.key === "assign" ? setDialog("dispatch") : void perform(primary.key as IncidentCommandAction)}>{busy ? primary.key === "claim" ? "담당 지정 중…" : "처리 중" : awaitingController?"내게 배정":primary.label}</button>}<p className="incident-permission-note">{primary?.key === "acknowledge" || primary?.key === "claim" ? "사건 확인 및 선점 권한이 필요합니다." : primary?.key === "review" || primary?.key === "decide" ? "사건 검토 권한이 필요합니다." : primary?.key === "assign" ? "출동 배정 권한이 필요합니다." : "권한과 사건 상태에 따라 업무가 제공됩니다."}</p>{incident.status === "CLAIMED" && adapter.mode === "mock" && <button className="incident-secondary" disabled={!adapter.supportsRelease} title={adapter.supportsRelease ? "담당 해제" : "준비 중"} onClick={() => adapter.supportsRelease && void perform("release")}>{adapter.supportsRelease ? "담당 해제" : "담당 해제 · 준비 중"}</button>}</>}
           <dl className="command-assignee"><div><dt>담당 관제자</dt><dd>{incident.assigned_controller?`${incident.assigned_controller.display_name}${incident.assigned_controller.public_id===user?.publicId?" · 나":""}`:"미지정"}</dd></div><div><dt>실시간 상태</dt><dd>{incidentStatusLabel[incident.status]}</dd></div><div><dt>최근 업데이트</dt><dd>{formatKst(incident.updated_at)} KST</dd></div></dl>
          </>}/>
        </aside>
      </div>
    </main>
    {dialog==="close"&&<ActionDialog type="close" record={record} evidence={evidence} busy={busy} onClose={()=>{setDialog(null);requestAnimationFrame(()=>closureTriggerRef.current?.focus())}} onConfirm={payload=>void perform("close",payload)}/>}
    {focusOpen&&evidence&&<EvidenceFocusDialog incidentNo={incident.incident_no} evidences={evidences} selectedId={evidence.detection_public_id} view={view} onSelect={updateFocusSelection} onView={updateFocusView} onClose={closeFocus} renderVisual={(item,mode)=>mode==="compare"?<EvidenceCompareViewer evidence={item} incidentNo={incident.incident_no}/>:<EvidenceFigure evidence={item} annotated={mode==="annotated"} incidentNo={incident.incident_no}/>}/>}
  </div>;
}

function StatePage({ title, body }: { title: string; body: string }) { return <><LandingHeader showSections={false} /><main className="incident-state"><h1>{title}</h1><p>{body}</p><Link href="/control">관제로 돌아가기</Link></main></>; }

function ActionDialog({ type, record, evidence, busy, embedded=false, onClose, onConfirm }: { type: "decision" | "dispatch" | "close"; record:IncidentDetailRecord; evidence?:IncidentEvidence; busy: boolean; embedded?:boolean; onClose: () => void; onConfirm: (payload?: IncidentDecisionPayload | IncidentClosePayload | { responder_public_id: string; request_message: string }) => void }) {
  const [responders, setResponders] = useState<DispatchResponderOption[]>([]), [responderId, setResponderId] = useState(""), [message, setMessage] = useState("현장 확인 및 조치를 요청합니다."), [respondersLoading, setRespondersLoading] = useState(false), [respondersError, setRespondersError] = useState("");
  useEffect(() => { if (type !== "dispatch" || !adapter.supportsDispatchAssignment) return; setRespondersLoading(true); adapter.listResponders().then(items => { setResponders(items); setResponderId(items.find(item => item.available)?.public_id ?? ""); }).catch(() => setRespondersError("출동 담당자를 불러오지 못했습니다.")).finally(() => setRespondersLoading(false)); }, [type]);
  useEffect(()=>{if(type!=="close"||embedded)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!busy)onClose()};document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape)},[busy,embedded,onClose,type]);
  if(type==="decision")return <FinalDecisionPanel incident={record.incident} evidence={evidence} busy={busy} onCancel={onClose} onConfirm={onConfirm}/>;
  const invalid = type === "dispatch" ? !responderId || !adapter.supportsDispatchAssignment : false;
  const content=<section className={`incident-dialog ${embedded?"incident-dialog--rail":""}`} role={embedded?"region":"dialog"} aria-modal={embedded?undefined:true} aria-labelledby="incident-dialog-title"><h2 id="incident-dialog-title">{type === "dispatch" ? "출동 담당자 배정" : "사건 최종 종료 확인"}</h2><p>{type === "dispatch" ? "배정할 출동 담당자를 선택해 주세요." : record.field_action_supported===false?`${record.incident.incident_no}의 조치 결과 조회 API는 아직 제공되지 않습니다. 서버의 완료 보고서 검증 후 종료됩니다.`:`${record.incident.incident_no}의 현장 조치 결과를 확인했습니다.`}</p>{type === "dispatch" ? <><label>출동 담당자<select value={responderId} disabled={!adapter.supportsDispatchAssignment || respondersLoading || !!respondersError} onChange={event => setResponderId(event.target.value)}><option value="">{respondersLoading ? "담당자를 불러오는 중입니다" : adapter.supportsDispatchAssignment ? "담당자를 선택하세요" : "출동 배정 준비 중"}</option>{responders.map(item => <option key={item.public_id} value={item.public_id} disabled={!item.available}>{item.display_name}{item.organization_name ? ` · ${item.organization_name}` : ""}{item.available ? "" : " · 배정 불가"}</option>)}</select></label>{respondersError && <p role="alert">{respondersError}</p>}<label>관제 요청 메시지<textarea value={message} disabled={!adapter.supportsDispatchAssignment} onChange={event => setMessage(event.target.value)} /></label></>:<dl className="closure-confirm-summary"><div><dt>출동 담당자</dt><dd>{record.dispatch?.responder_label??"조회 API 미지원"}</dd></div><div><dt>조치 내용</dt><dd>{record.field_action?.detail??"조회 API 미지원"}</dd></div><div><dt>조치 등록 시각</dt><dd>{record.field_action?.completed_at?`${formatKst(record.field_action.completed_at)} KST`:"정보 없음"}</dd></div></dl>}<div><button autoFocus onClick={onClose}>취소</button><button disabled={busy || invalid} onClick={() => onConfirm(type === "dispatch" ? { responder_public_id: responderId, request_message: message.trim() } : {closure_note:"현장 조치 완료 상태를 확인하고 사건을 종료합니다."})}>{busy ? "처리 중" : type==="close"?"사건 최종 종료":"확인"}</button></div></section>;
  return embedded?content:<div className="incident-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>{content}</div>;
}
