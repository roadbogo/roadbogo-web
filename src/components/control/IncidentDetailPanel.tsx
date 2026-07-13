import { useEffect, useRef } from "react";
import type { Incident, IncidentStatus } from "@/components/control/controlTypes";

interface IncidentDetailPanelProps {
  incident: Incident | null;
  open: boolean;
  onClose: () => void;
  onClaim: () => void;
  onConfirm: () => void;
  onFalsePositive: () => void;
  onDispatchRequest: () => void;
  onCctvClick: (cctvId: string) => void;
}

const statusLabel: Record<IncidentStatus, string> = {
  new: "신규 탐지",
  claimed: "선점됨",
  confirmed: "실제 위험",
  falsePositive: "오탐",
  dispatchRequested: "출동 요청됨",
  dispatched: "출동 진행 중",
  resolved: "조치 완료"
};

export function IncidentDetailPanel({
  incident,
  open,
  onClose,
  onClaim,
  onConfirm,
  onFalsePositive,
  onDispatchRequest,
  onCctvClick
}: IncidentDetailPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  if (!open || !incident) {
    return null;
  }

  const canClaim = incident.status === "new";
  const canJudge = incident.status === "claimed";
  const canDispatch = incident.status === "confirmed";
  const isFalsePositive = incident.status === "falsePositive";
  const isDispatched = incident.status === "dispatchRequested" || incident.status === "dispatched";

  return (
    <div className="detail-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="사건 상세 패널">
      <aside className="detail-panel" onClick={(event) => event.stopPropagation()}>
        <div className="detail-panel__header">
          <div>
            <p className="detail-panel__label">사건 상세</p>
            <h2>{incident.number}</h2>
          </div>
          <button type="button" ref={closeButtonRef} className="detail-panel__close" onClick={onClose} aria-label="상세 패널 닫기">
            ×
          </button>
        </div>

        <div className="detail-panel__summary">
          <span className={`status-pill status-pill--${incident.severity === "긴급" ? "danger" : incident.severity === "주의" ? "warning" : "review"}`}>
            {statusLabel[incident.status]}
          </span>
          <span className={`status-pill status-pill--${incident.risk >= 90 ? "danger" : incident.risk >= 80 ? "warning" : "review"}`}>
            {incident.riskLabel}
          </span>
        </div>

        <div className="detail-panel__grid">
          <div>
            <p>객체 유형</p>
            <strong>{incident.type}</strong>
          </div>
          <div>
            <p>도로명</p>
            <strong>{incident.road}</strong>
          </div>
          <div>
            <p>진행 방향</p>
            <strong>{incident.direction}</strong>
          </div>
          <div>
            <p>구간 / 거리</p>
            <strong>{incident.segment}</strong>
          </div>
          <div>
            <p>연결 CCTV</p>
            <strong>
              <button type="button" className="detail-panel__cctv-link" onClick={() => onCctvClick(incident.cctvId)}>
                {incident.cctvId}
              </button>
            </strong>
          </div>
          <div>
            <p>AI 탐지 근거</p>
            <strong>{incident.evidence}</strong>
          </div>
          <div>
            <p>최초 탐지 시간</p>
            <strong>{incident.detectedAt}</strong>
          </div>
          <div>
            <p>대기 시간</p>
            <strong>{incident.waiting}</strong>
          </div>
          <div>
            <p>담당자</p>
            <strong>{incident.assignedTo ?? "미배정"}</strong>
          </div>
          <div>
            <p>출동 요청 여부</p>
            <strong>{incident.dispatchRequested ? "요청됨" : "미 요청"}</strong>
          </div>
        </div>

        <div className="detail-panel__video">
          <div className="detail-panel__video-label">확대 영상</div>
          <div className="detail-panel__video-placeholder">VIDEO</div>
        </div>

        <div className="detail-panel__actions">
          <button type="button" onClick={onClaim} disabled={!canClaim} title={canClaim ? "사건을 선점합니다" : "신규 탐지 후에만 선점할 수 있습니다"}>
            사건 선점
          </button>
          <button type="button" onClick={onConfirm} disabled={!canJudge} title={canJudge ? "실제 위험으로 판정합니다" : "사건을 선점한 후에만 가능합니다"}>
            실제 위험
          </button>
          <button type="button" onClick={onFalsePositive} disabled={!canJudge} title={canJudge ? "오탐으로 판정합니다" : "사건을 선점한 후에만 가능합니다"}>
            오탐
          </button>
          <button type="button" onClick={onDispatchRequest} disabled={!canDispatch || isFalsePositive || incident.dispatchRequested} title={incident.dispatchRequested ? "이미 출동 요청됨" : canDispatch ? "출동을 요청합니다" : "실제 위험 판정 후에만 출동 요청할 수 있습니다"}>
            출동 요청
          </button>
        </div>
      </aside>
    </div>
  );
}
