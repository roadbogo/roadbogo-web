import type { ActivityLogEntry } from "@/components/control/controlTypes";

interface ActivityLogProps {
  logs: ActivityLogEntry[];
  onLogActivate?: (incidentId: string) => void;
}

export function ActivityLog({ logs, onLogActivate }: ActivityLogProps) {
  return (
    <div className="activity-log-panel">
      <div className="activity-log-panel__header">
        <p className="panel-eyebrow">최근 활동 로그</p>
        <h3>운영 이력</h3>
      </div>
      <div className="activity-log-list">
        {logs.map((item) => (
          <article
            key={item.id}
            className={`activity-log-item ${item.incidentId ? "activity-log-item--clickable" : ""}`}
            role={item.incidentId ? "button" : undefined}
            tabIndex={item.incidentId ? 0 : undefined}
            onClick={item.incidentId ? () => onLogActivate?.(item.incidentId!) : undefined}
            onKeyDown={item.incidentId ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onLogActivate?.(item.incidentId!);
              }
            } : undefined}
          >
            <div className="activity-log-item__meta">
              <span>{item.time}</span>
              <strong>{item.actor}</strong>
              <span className={`activity-badge activity-badge--${item.variant}`}>{item.badge}</span>
            </div>
            <p>{item.action}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
