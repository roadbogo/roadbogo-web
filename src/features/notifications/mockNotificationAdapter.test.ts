import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { mockNotificationAdapter } from "./mockNotificationAdapter";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";

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
const responder = (publicId: string): AuthenticatedUser => ({
  publicId,
  name: "테스트 출동 담당자",
  role: "RESPONDER",
  roles: ["RESPONDER"],
  email: `${publicId}@example.com`,
  apiPermissions: ["DISPATCH.READ_OWN"],
  uiRoles: ["FIELD_RESPONDER"],
  uiPermissions: ["profile:view", "dispatch:assigned"],
});
const general = (publicId: string): AuthenticatedUser => ({
  publicId,name:"일반 사용자",role:"GENERAL_USER",roles:["GENERAL_USER"],email:`${publicId}@example.com`,
  apiPermissions:[],uiRoles:[],uiPermissions:["profile:view"],
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

  it("links incident notifications by UUID while keeping the incident number as a label", async () => {
    const page = await mockNotificationAdapter.list(controller("controller-links"));
    const incident = page.items.find(item => item.resource.resource_label === "INC-20260719-0012");
    const dashboardIncident = createMockDashboardSnapshot().incidents
      .find(item => item.incident_no === "INC-20260719-0012");

    expect(incident?.resource.resource_public_id).toBe(dashboardIncident?.public_id);
    expect(incident?.resource.resource_public_id).not.toBe(incident?.resource.resource_label);
  });

  it("links dispatch notifications to the same Dashboard dispatch UUID while keeping a display label", async () => {
    const page = await mockNotificationAdapter.list(responder("responder-links"));
    const notification = page.items.find(item => item.resource.resource_label === "DSP-20260719-0031");
    const dispatch = createMockDashboardSnapshot().dispatches
      .find(item => item.public_id === notification?.resource.resource_public_id);

    expect(notification?.resource.resource_public_id).toBe(dispatch?.public_id);
    expect(notification?.resource.resource_public_id).not.toBe(notification?.resource.resource_label);
  });

  it("keeps role-filtered unread counts without inventing general-user notifications",async()=>{
    expect((await mockNotificationAdapter.list(controller("controller-visible"))).unread_count).toBeGreaterThan(0);
    expect((await mockNotificationAdapter.list(responder("responder-visible"))).unread_count).toBeGreaterThan(0);
    expect((await mockNotificationAdapter.list(general("general-filtered"))).unread_count).toBe(0);
  });
});
