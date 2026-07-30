// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { LandingPage } from "./LandingPage";

const auth = vi.hoisted(() => ({
  state: { user: null as AuthenticatedUser | null, ready: true },
}));

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("@/components/auth/AuthContext", () => ({ useAuth: () => auth.state }));
vi.mock("./LandingHeader", () => ({ LandingHeader: () => <nav aria-label="테스트 헤더"><button>서비스 소개</button><button>운영 체계 안내</button></nav> }));
vi.mock("./LandingCarousel", () => ({ LandingCarousel: () => <div data-testid="landing-carousel" /> }));
vi.mock("./PlatformOperationsCarousel", () => ({ PlatformOperationsCarousel: () => <section id="platform-operations" tabIndex={-1}><h2>운영 체계 안내</h2></section> }));

const user = (role: AuthenticatedUser["role"], access: boolean): AuthenticatedUser => ({
  publicId: `${role.toLowerCase()}-1`,
  name: role,
  role,
  roles: [role],
  email: `${role.toLowerCase()}@example.test`,
  accountStatus: "ACTIVE",
  apiPermissions: access ? role === "SYSTEM_ADMIN" ? ["INCIDENT.READ_ALL"] : ["CCTV.READ"] : role === "RESPONDER" ? ["DISPATCH.READ_OWN"] : [],
  uiRoles: access ? role === "SYSTEM_ADMIN" ? ["SYSTEM_ADMIN"] : ["CONTROL_OPERATOR"] : role === "RESPONDER" ? ["FIELD_RESPONDER"] : [],
  uiPermissions: access ? role === "SYSTEM_ADMIN" ? ["incidents:view"] : ["control:view"] : role === "RESPONDER" ? ["dispatch:assigned"] : ["profile:view"],
});

afterEach(() => {
  cleanup();
  auth.state = { user: null, ready: true };
});

describe("LandingPage permission-aware CTAs", () => {
  it.each([
    ["CONTROL_MANAGER", user("CONTROL_MANAGER", true)],
    ["CONTROLLER", user("CONTROLLER", true)],
  ] as const)("shows both CTAs for %s with actual control access", (_role, authenticatedUser) => {
    auth.state = { user: authenticatedUser, ready: true };
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: /실시간 관제 보기/ })).toHaveAttribute("href", "/control");
    expect(screen.getAllByRole("button", { name: /운영 체계 안내/ }).length).toBeGreaterThan(0);
  });

  it("reuses the existing gradient primary action for the system administrator console", () => {
    auth.state = { user: user("SYSTEM_ADMIN", true), ready: true };
    render(<LandingPage />);

    const action = screen.getByRole("link", { name: /관리 콘솔 열기/ });
    expect(action).toHaveAttribute("href", "/admin");
    expect(action).toHaveClass("stage-primary");
    expect(screen.queryByRole("link", { name: /실시간 관제 보기/ })).not.toBeInTheDocument();
    expect(screen.getByText("시스템 관리자 모드")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /운영 체계 안내/ }).at(-1)).not.toHaveClass("stage-primary");
  });

  it.each([
    ["RESPONDER", user("RESPONDER", false)],
    ["GENERAL_USER", user("GENERAL_USER", false)],
  ] as const)("shows only the primary guide CTA for %s", (_label, authenticatedUser) => {
    auth.state = { user: authenticatedUser, ready: true };
    render(<LandingPage />);

    expect(screen.queryByRole("link", { name: /실시간 관제 보기/ })).not.toBeInTheDocument();
    const guide = screen.getAllByRole("button", { name: /운영 체계 안내/ }).at(-1);
    expect(guide).toHaveClass("stage-primary");
  });

  it("keeps the anonymous control link after auth restore completes", () => {
    auth.state = { user: null, ready: true };
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: /실시간 관제 보기/ })).toHaveAttribute("href", "/control");
    expect(screen.getAllByText("운영 체계 안내")).toHaveLength(3);
  });

  it("does not flash the control CTA before auth restore completes", () => {
    auth.state = { user: null, ready: false };
    render(<LandingPage />);

    expect(screen.queryByRole("link", { name: /실시간 관제 보기/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /운영 체계 안내/ }).at(-1)).toHaveClass("stage-primary");
  });

  it("keeps the guide CTA connected to the existing section interaction", () => {
    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const event = vi.fn();
    window.addEventListener("roadbogo:platform-slide", event);
    render(<LandingPage />);
    const section = document.getElementById("platform-operations")!;
    section.scrollIntoView = scrollIntoView;
    section.focus = focus;

    fireEvent.click(screen.getAllByRole("button", { name: /운영 체계 안내/ }).at(-1)!);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(event).toHaveBeenCalledTimes(1);
    window.removeEventListener("roadbogo:platform-slide", event);
  });
});
