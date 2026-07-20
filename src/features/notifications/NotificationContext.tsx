"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { deriveNotificationActionState, resolveNotificationTarget } from "./notificationDomain";
import { getMockNotificationEvidence, getMockResourceState, mockNotificationAdapter } from "./mockNotificationAdapter";
import type { NotificationRecord, NotificationTargetPath, NotificationViewModel, RealtimeStatus } from "./notificationTypes";

type NotificationValue = {
  items: NotificationViewModel[];
  unreadCount: number;
  actionCount: number;
  loading: boolean;
  error: string;
  toast: string;
  realtimeStatus: RealtimeStatus;
  refresh: () => Promise<void>;
  markRead: (publicId: string) => Promise<boolean>;
  markAllRead: () => Promise<boolean>;
  targetFor: (item: NotificationViewModel) => NotificationTargetPath | null;
};

const NotificationContext = createContext<NotificationValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const [records, setRecords] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const pendingReads = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (!user) { setRecords([]); return; }
    setLoading(true);
    setError("");
    try {
      const page = await mockNotificationAdapter.list(user);
      setRecords(page.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알림을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (ready) void refresh(); }, [ready, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const items = useMemo<NotificationViewModel[]>(() => {
    if (!user) return [];
    return records.map(notification => {
      const action = deriveNotificationActionState(notification, getMockResourceState(notification.resource.resource_public_id, user), user);
      return {
        ...notification,
        ...action,
        target_path: resolveNotificationTarget(notification, user),
        resource_label: notification.resource.resource_public_id,
        evidence: getMockNotificationEvidence(notification.resource.resource_public_id),
      };
    });
  }, [records, user]);

  const markRead = useCallback(async (publicId: string) => {
    if (!user?.publicId) return false;
    const existing = records.find(item => item.public_id === publicId);
    if (!existing || existing.read || pendingReads.current.has(publicId)) return true;
    pendingReads.current.add(publicId);
    setRecords(current => current.map(item => item.public_id === publicId ? { ...item, read: true, read_at: new Date().toISOString() } : item));
    try {
      await mockNotificationAdapter.markRead(user, publicId);
      return true;
    } catch {
      setRecords(current => current.map(item => item.public_id === publicId ? existing : item));
      setToast("알림 읽음 처리에 실패했습니다");
      return false;
    } finally {
      pendingReads.current.delete(publicId);
    }
  }, [records, user]);

  const markAllRead = useCallback(async () => {
    if (!user?.publicId) return false;
    const previous = records;
    const readAt = new Date().toISOString();
    setRecords(current => current.map(item => ({ ...item, read: true, read_at: item.read_at ?? readAt })));
    try {
      await mockNotificationAdapter.markAllRead(user);
      setToast("모든 알림을 읽음 처리했습니다");
      return true;
    } catch {
      setRecords(previous);
      setToast("모두 읽음 처리에 실패했습니다");
      return false;
    }
  }, [records, user]);

  const value = useMemo<NotificationValue>(() => ({
    items,
    unreadCount: items.filter(item => !item.read).length,
    actionCount: items.filter(item => item.action_required).length,
    loading,
    error,
    toast,
    realtimeStatus: "unavailable",
    refresh,
    markRead,
    markAllRead,
    targetFor: item => item.target_path,
  }), [error, items, loading, markAllRead, markRead, refresh, toast]);

  return <NotificationContext.Provider value={value}>{children}{toast && <p className="notification-global-toast" role="status" aria-live="polite">{toast}</p>}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationProvider");
  return value;
}
