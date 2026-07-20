"use client";

import { formatExactKst, formatRelativeTime, notificationPresentation, notificationStateCopy, severityLabels } from "./notificationDomain";
import type { NotificationViewModel } from "./notificationTypes";
import styles from "./notifications.module.css";

export const NotificationTypeIcon = ({ kind }: { kind: "incident" | "dispatch" | "complete" }) => <svg viewBox="0 0 24 24" aria-hidden="true">
  {kind === "incident" ? <><path d="M12 3 2.8 20h18.4Z" /><path d="M12 9v5M12 17h.01" /></> : kind === "dispatch" ? <><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7z" /><circle cx="7" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></> : <><path d="M7 4h10v17H7zM9 4V2h6v2" /><path d="m9 13 2 2 4-5" /></>}
</svg>;

export function NotificationRow({ item, onOpen, compact = false }: { item: NotificationViewModel; onOpen: (item: NotificationViewModel) => void; compact?: boolean }) {
  const presentation = notificationPresentation[item.notification_type];
  return <article className={`${styles.row} ${!item.read ? styles.unread : ""} ${compact ? styles.compactRow : ""}`}>
    <button type="button" className={styles.rowMain} onClick={() => onOpen(item)} aria-label={`${item.read ? "읽음" : "읽지 않음"} · ${item.title}`}>
      <span className={styles.readState} aria-hidden="true" />
      <span className={`${styles.typeIcon} ${styles[`severity${item.severity}`]}`}><NotificationTypeIcon kind={presentation.icon} /></span>
      <span className={styles.rowCopy}>
        <span className={styles.rowTitle}><strong>{item.title}</strong><time dateTime={item.created_at} title={formatExactKst(item.created_at)}>{formatRelativeTime(item.created_at)}</time></span>
        <span className={styles.rowBody}>{item.body}</span>
        <span className={styles.rowMeta}><b className={styles[`severity${item.severity}`]}>{severityLabels[item.severity]}</b><span>{item.resource_label}</span><span>{notificationStateCopy(item)}</span></span>
      </span>{compact && <span className={styles.rowChevron} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg></span>}
    </button>
    {!compact && item.action_required && item.action_label && item.target_path && <button type="button" className={styles.rowAction} onClick={() => onOpen(item)}>{item.action_label}</button>}
  </article>;
}
