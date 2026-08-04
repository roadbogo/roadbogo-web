"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { createIdempotencyKey } from "@/lib/apiClient";
import { formatRiskGrade } from "@/features/control-dashboard/dashboardDomain";
import { createDispatchAdapter } from "./dispatchAdapterFactory";
import { canExecuteDispatchAction,canRespondToDispatch,dispatchProgressAction,dispatchProgressIndex,dispatchProgressStatuses,dispatchStatusCopy,formatDispatchKst,getNextDispatchAction,validateRejectionReason,type DispatchProgressAction } from "./dispatchDomain";
import type { DispatchDetail, DispatchItem } from "./dispatchTypes";
import {notifyDispatchChanged} from "./dispatchSync";
import "./dispatch.css";
import "./dispatchProgress.css";

const adapter = createDispatchAdapter();
const errorCopy: Record<string, string> = {
  DISPATCH_NOT_FOUND: "출동 정보를 확인할 수 없습니다.",
  DISPATCH_VERSION_CONFLICT: "다른 변경이 먼저 반영되어 최신 출동 정보를 불러왔습니다.",
  DISPATCH_INVALID_STATE_TRANSITION: "현재 출동 상태에서는 해당 작업을 진행할 수 없습니다.",
  DISPATCH_IDEMPOTENCY_CONFLICT: "동일 요청 키가 다른 작업에 사용되었습니다. 작업 내용을 확인한 뒤 다시 시도해 주세요.",
  DISPATCH_NOT_ASSIGNED_RESPONDER: "현재 계정은 이 출동 상태를 변경할 수 없습니다.",
  INCIDENT_INVALID_STATE_TRANSITION: "연결된 사건 상태가 변경되어 최신 정보를 불러왔습니다.",
  "403": "현재 계정은 이 출동 상태를 변경할 수 없습니다.",
  "422": "요청 내용을 확인해 주세요.",
};

export function DispatchWorkspace({initialPublicId=""}:{initialPublicId?:string}={}) {
  const { user } = useAuth();
  const [activeOnly, setActiveOnly] = useState(!initialPublicId);
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [selectedId, setSelectedId] = useState(initialPublicId);
  const [detail, setDetail] = useState<DispatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [progressDialog,setProgressDialog]=useState<DispatchProgressAction|null>(null);
  const [reason, setReason] = useState("");
  const busyRef = useRef(false);
  const progressTriggerRef=useRef<HTMLButtonElement>(null);

  const loadList = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const page = await adapter.list({ page: 1, size: 20, activeOnly });
      setItems(page.items);
      setSelectedId((current) => initialPublicId || current || page.items[0]?.publicId || "");
    } catch { setError("출동 목록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [activeOnly, initialPublicId]);

  const loadDetail = useCallback(async (publicId: string) => {
    if (!publicId) { setDetail(null); return; }
    setDetailLoading(true);
    try {
      const next = await adapter.detail(publicId); setDetail(next);
      if (!next) setNotice("출동 정보를 확인할 수 없습니다.");
    } catch { setNotice("출동 상세를 불러오지 못했습니다."); }
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadDetail(selectedId); }, [loadDetail, selectedId]);

  const canUpdate = detail ? canRespondToDispatch(detail.status, detail.versionNo, user?.apiPermissions ?? [], busy) : false;
  const nextProgress=detail?getNextDispatchAction(detail.status):null;
  const canProgress=detail?canExecuteDispatchAction(detail.status,detail.versionNo,user?.apiPermissions??[],busy):false;
  const command = async (action: "accept" | "reject") => {
    if (!detail || busyRef.current) return;
    const validation = action === "reject" ? validateRejectionReason(reason) : null;
    if (validation) { setNotice(validation); return; }
    busyRef.current = true; setBusy(true); setNotice("");
    const key = createIdempotencyKey();
    try {
      const result = action === "accept"
        ? await adapter.accept(detail.publicId, detail.versionNo, key, detail)
        : await adapter.reject(detail.publicId, detail.versionNo, reason.trim(), key, detail);
      if (result.ok) {
        setDetail(result.detail);
        notifyDispatchChanged();
        setNotice(result.syncWarning ? "처리는 완료됐지만 최신 상세 정보를 다시 불러오지 못했습니다." : action === "accept" ? "출동 요청을 수락했습니다." : "출동 요청을 거절했습니다.");
        setRejecting(false); setReason("");
        await loadList();
        if (action === "accept") setSelectedId(result.detail.publicId);
      } else {
        setDetail(result.latest);
        setNotice(errorCopy[result.code] ?? "출동 요청을 처리하지 못했습니다.");
        if (result.code === "DISPATCH_INVALID_STATE_TRANSITION") setRejecting(false);
      }
    } catch { setNotice("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const closeProgressDialog=useCallback(()=>{if(busy)return;setProgressDialog(null);window.requestAnimationFrame(()=>progressTriggerRef.current?.focus())},[busy]);
  useEffect(()=>{if(!progressDialog)return;const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();closeProgressDialog()}};document.addEventListener("keydown",closeOnEscape);return()=>document.removeEventListener("keydown",closeOnEscape)},[closeProgressDialog,progressDialog]);
  const executeProgress=async(action:DispatchProgressAction)=>{
    if(!detail||busyRef.current||getNextDispatchAction(detail.status)!==action)return;
    busyRef.current=true;setBusy(true);setNotice("");
    const key=createIdempotencyKey();
    try{
      const result=action==="depart"?await adapter.depart(detail.publicId,detail.versionNo,key,detail)
        :action==="markEnRoute"?await adapter.markEnRoute(detail.publicId,detail.versionNo,key,detail)
        :action==="arrive"?await adapter.arrive(detail.publicId,detail.versionNo,key,detail)
        :await adapter.startAction(detail.publicId,detail.versionNo,key,detail);
      if(result.ok){setDetail(result.detail);notifyDispatchChanged();const success:Record<DispatchProgressAction,string>={depart:"출발 상태를 등록했습니다.",markEnRoute:"이동 중 상태를 등록했습니다.",arrive:"현장 도착을 등록했습니다.",startAction:"현장 조치를 시작했습니다."};setNotice(result.syncWarning?"처리는 완료됐지만 최신 상세 정보를 다시 불러오지 못했습니다.":success[action]);setProgressDialog(null);await loadList();setSelectedId(result.detail.publicId)}
      else{setDetail(result.latest);setNotice(errorCopy[result.code]??"출동 상태를 변경하지 못했습니다.");setProgressDialog(null)}
    }catch{setNotice("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.")}
    finally{busyRef.current=false;setBusy(false)}
  };

  return <div className="dispatch-page">
    <main className="dispatch-shell">
      <header className="dispatch-heading"><div><p>FIELD RESPONSE</p><h1>내 출동 요청</h1><span>배정된 출동 요청을 확인하고 수락 또는 거절합니다.</span></div><em>{adapter.mode === "mock" ? "시연 데이터" : "운영 데이터"}</em></header>
      <section className="dispatch-workspace">
        <div className="dispatch-queue">
          <header><div role="tablist" aria-label="출동 목록 범위"><button role="tab" aria-selected={activeOnly} onClick={() => setActiveOnly(true)}>진행 중</button><button role="tab" aria-selected={!activeOnly} onClick={() => setActiveOnly(false)}>전체 이력</button></div><button onClick={() => void loadList()} disabled={loading}>새로고침</button></header>
          {loading ? <p className="dispatch-state" role="status">출동 목록을 불러오는 중입니다.</p>
            : error ? <div className="dispatch-state" role="alert"><p>{error}</p><button onClick={() => void loadList()}>다시 시도</button></div>
            : items.length === 0 ? <p className="dispatch-state">{activeOnly ? "현재 배정된 출동 요청이 없습니다." : "출동 이력이 없습니다."}</p>
            : <div className="dispatch-list" role="listbox" aria-label="내 출동 목록">{items.map((item) => <button key={item.publicId} role="option" aria-selected={item.publicId === selectedId} className={item.publicId === selectedId ? "is-selected" : ""} onClick={() => setSelectedId(item.publicId)}><span><b>{dispatchStatusCopy[item.status]}</b><time>{formatDispatchKst(item.requestedAt)} KST</time></span><strong>{item.incident.incidentNo}</strong><em>{item.incident.objectCategory} · {formatRiskGrade(item.incident.riskGrade)}</em><small>{item.incident.cctvName} · {item.incident.roadName} · {item.incident.roadSectionName}</small></button>)}</div>}
        </div>
        <aside className="dispatch-detail">
          {detailLoading ? <p className="dispatch-state" role="status">출동 상세를 불러오는 중입니다.</p>
            : !detail ? <p className="dispatch-state">{selectedId ? "출동 정보를 확인할 수 없습니다." : "확인할 출동을 선택해 주세요."}</p>
            : <><header><div><span>DISPATCH DETAIL</span><h2>{detail.incident.incidentNo}</h2></div><b>{dispatchStatusCopy[detail.status]}</b></header>
              <dl><div><dt>사건 유형</dt><dd>{detail.incident.objectCategory} · {formatRiskGrade(detail.incident.riskGrade)}</dd></div><div><dt>CCTV</dt><dd>{detail.incident.cctvName}</dd></div><div><dt>위치</dt><dd>{detail.incident.roadName}<br />{detail.incident.roadSectionName}</dd></div><div><dt>요청 시각</dt><dd>{formatDispatchKst(detail.requestedAt)} KST</dd></div><div><dt>요청 관제자</dt><dd>{detail.assignedBy.name}</dd></div></dl>
              {detail.requestMessage && <section><span>관제 요청</span><p>{detail.requestMessage}</p></section>}
              {detail.rejectionReason && <section><span>거절 사유</span><p>{detail.rejectionReason}</p></section>}
              {notice && <p className="dispatch-notice" role="status">{notice}</p>}
              {detail.status === "REQUESTED" && <div className="dispatch-actions"><button disabled={!canUpdate} onClick={() => setRejecting(true)}>거절</button><button disabled={!canUpdate} aria-busy={busy} onClick={() => void command("accept")}>{busy ? "처리 중" : "수락"}</button>{!user?.apiPermissions.includes("DISPATCH.UPDATE_OWN") && <p>현재 계정에는 출동 응답 권한이 없습니다.</p>}</div>}
              {dispatchProgressIndex(detail.status)>=0&&detail.status!=="ACTION_COMPLETED"&&<><ol className="dispatch-progress" aria-label="출동 진행 단계">{dispatchProgressStatuses.map((status,index)=>{const current=dispatchProgressIndex(detail.status),state=index<current?"complete":index===current?"current":"pending";return <li key={status} data-state={state} aria-current={state==="current"?"step":undefined}><i aria-hidden="true">{state==="complete"?"✓":index+1}</i><span>{status==="ACCEPTED"?"요청 수락":status==="DEPARTED"?"출발":status==="EN_ROUTE"?"이동 중":status==="ARRIVED"?"현장 도착":"현장 조치"}</span><small>{state==="complete"?"완료":state==="current"?"현재 단계":"예정"}</small></li>})}</ol><section className="dispatch-current-task"><span>현재 업무</span>{detail.status==="ACTION_IN_PROGRESS"?<><strong>현장 조치가 진행 중입니다.</strong><p>조치 결과와 현장 사진을 등록해 주세요.</p><Link className="dispatch-action-link" href={`/dispatch/${encodeURIComponent(detail.publicId)}/action`}>현장 조치 등록</Link></>:nextProgress?<><strong>{dispatchProgressAction[nextProgress].title}</strong><p>{dispatchProgressAction[nextProgress].description}</p><button ref={progressTriggerRef} type="button" disabled={!canProgress} onClick={()=>setProgressDialog(nextProgress)}>{dispatchProgressAction[nextProgress].label}</button>{!user?.apiPermissions.includes("DISPATCH.UPDATE_OWN")&&<small>현재 계정에는 본인 출동 상태 변경 권한이 없습니다.</small>}</>:null}</section></>}
              {["REJECTED", "CANCELLED", "ACTION_COMPLETED"].includes(detail.status) && <div className="dispatch-complete">이 출동 요청은 더 이상 응답할 수 없습니다.{detail.status==="ACTION_COMPLETED"&&<Link className="dispatch-action-link" href={`/dispatch/${encodeURIComponent(detail.publicId)}/action`}>제출한 조치 결과 보기</Link>}</div>}
            </>}
        </aside>
      </section>
    </main>
    {rejecting && detail && <div className="dispatch-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setRejecting(false); }}><section role="dialog" aria-modal="true" aria-labelledby="reject-title" className="dispatch-dialog"><h2 id="reject-title">출동 요청 거절</h2><p>거절 사유는 관제 담당자가 후속 배정을 판단할 때 사용합니다.</p><label>거절 사유<textarea maxLength={1001} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(validateRejectionReason(reason) && reason.length > 0)} /><span>{reason.length} / 1000자</span></label>{reason.length > 1000 && <p role="alert">거절 사유는 1000자 이하로 입력해 주세요.</p>}<div><button disabled={busy} onClick={() => setRejecting(false)}>취소</button><button disabled={busy || Boolean(validateRejectionReason(reason))} aria-busy={busy} onClick={() => void command("reject")}>{busy ? "처리 중" : "거절 제출"}</button></div></section></div>}
    {progressDialog&&detail&&<div className="dispatch-dialog-backdrop" onMouseDown={event=>event.target===event.currentTarget&&closeProgressDialog()}><section role="dialog" aria-modal="true" aria-labelledby="progress-dialog-title" className="dispatch-dialog dispatch-progress-dialog"><h2 id="progress-dialog-title">{dispatchProgressAction[progressDialog].confirmTitle}</h2><p>{dispatchProgressAction[progressDialog].confirmDescription}</p><div><button type="button" autoFocus disabled={busy} onClick={closeProgressDialog}>취소</button><button type="button" disabled={busy} aria-busy={busy} onClick={()=>void executeProgress(progressDialog)}>{busy?"처리 중":dispatchProgressAction[progressDialog].label}</button></div></section></div>}
  </div>;
}
