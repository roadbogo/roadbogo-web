import type { CctvFeed, Incident } from "@/components/control/controlTypes";

interface CctvFocusModalProps {
  open: boolean;
  cctv: CctvFeed | null;
  relatedIncidents: Incident[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenIncident: (incidentId: string) => void;
}

export function CctvFocusModal({ open, cctv, relatedIncidents, onClose, onPrev, onNext, onOpenIncident }: CctvFocusModalProps) {
  if (!open || !cctv) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="CCTV 집중 보기">
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">{cctv.station}</p>
            <h2>{cctv.label}</h2>
            <p>{cctv.direction}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="CCTV 모달 닫기" className="modal-close">
            ×
          </button>
        </div>
        <div className="modal-live">
          <span>LIVE</span>
          <strong>탐지 지속 {cctv.duration}</strong>
        </div>
        <div className="modal-video-placeholder">VIDEO PLACEHOLDER</div>
        <div className="modal-detail-grid">
          <div>
            <p>탐지 객체</p>
            <strong>{cctv.event}</strong>
          </div>
          <div>
            <p>진행 방향</p>
            <strong>{cctv.direction}</strong>
          </div>
          <div>
            <p>연결 사건</p>
            <strong>{relatedIncidents.length}건</strong>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onPrev}>
            이전 CCTV
          </button>
          <button type="button" onClick={onNext}>
            다음 CCTV
          </button>
        </div>
        <div className="modal-linked-incidents">
          <p>관련 사건</p>
          {relatedIncidents.length > 0 ? (
            relatedIncidents.map((incident) => (
              <button key={incident.id} type="button" className="linked-incident" onClick={() => onOpenIncident(incident.id)}>
                {incident.number} - {incident.type}
              </button>
            ))
          ) : (
            <p>연결된 사건이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
