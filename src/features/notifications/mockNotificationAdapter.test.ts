import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { mockNotificationAdapter } from "./mockNotificationAdapter";

const controller = (publicId: string): AuthenticatedUser => ({
  publicId,
  name: "테스트 관제자",
  role: "CONTROLLER",
  roles: ["CONTROLLER"],
  email: `${publicId}@example.com`,
  apiPermissions: [],
  uiRoles: ["CONTROL_OPERATOR"],
  uiPermissions: ["profile:view"],
});

describe("mockNotificationAdapter read isolation", () => {
  it("keeps the same notification read state isolated by user", async () => {
    const first = controller("controller-read-a");
    const second = controller("controller-read-b");
    const before = await mockNotificationAdapter.list(first);
    const target = before.items.find(item => !item.read);
    expect(target).toBeTruthy();

    await mockNotificationAdapter.markRead(first, target!.public_id);

    expect((await mockNotificationAdapter.list(first)).items.find(item => item.public_id === target!.public_id)?.read).toBe(true);
    expect((await mockNotificationAdapter.list(second)).items.find(item => item.public_id === target!.public_id)?.read).toBe(false);
  });

  it("marks only the current user's visible notifications as read", async () => {
    const first = controller("controller-all-a");
    const second = controller("controller-all-b");
    await mockNotificationAdapter.markAllRead(first);

    expect((await mockNotificationAdapter.list(first)).unread_count).toBe(0);
    expect((await mockNotificationAdapter.list(second)).unread_count).toBeGreaterThan(0);
  });

  it("does not mutate read state without a public user id", async () => {
    const anonymous = { ...controller("temporary"), publicId: undefined };
    expect((await mockNotificationAdapter.list(anonymous)).items).toEqual([]);
    await expect(mockNotificationAdapter.markAllRead(anonymous)).rejects.toThrow();
  });
});
