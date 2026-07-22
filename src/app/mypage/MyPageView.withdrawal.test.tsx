// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { MyPageView } from "./MyPageView";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/landing/LandingHeader", () => ({ LandingHeader: () => <header /> }));
vi.mock("@/components/auth/AuthContext", () => ({ useAuth: () => ({ clearAuth: vi.fn() }) }));

const user = (roles: AuthenticatedUser["roles"]): AuthenticatedUser => ({ publicId: "user-1", name: "사용자", role: roles[0] ?? "GENERAL_USER", roles, email: "user@example.com", accountStatus: "ACTIVE", apiPermissions: [], uiRoles: [], uiPermissions: [] });
const renderSecurity = (roles: AuthenticatedUser["roles"]) => { render(<MyPageView user={user(roles)} onSave={vi.fn()} />); fireEvent.click(screen.getByRole("tab", { name: "보안 및 활동" })); };

afterEach(cleanup);
beforeEach(() => { window.requestAnimationFrame = callback => { callback(0); return 0; }; });

describe("MyPageView withdrawal entry", () => {
  it("shows the withdrawal menu only to a single-role general user", () => {
    renderSecurity(["GENERAL_USER"]);
    expect(screen.getByRole("button", { name: "탈퇴 진행" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "탈퇴 진행" }));
    expect(screen.getByRole("dialog", { name: "회원 탈퇴" })).toBeInTheDocument();
  });
  it.each<[AuthenticatedUser["roles"]]>([[["SYSTEM_ADMIN"]], [["CONTROL_MANAGER"]], [["CONTROLLER"]], [["RESPONDER"]], [["GENERAL_USER", "CONTROLLER"]], [[]]])("hides the withdrawal menu for roles %j", roles => {
    renderSecurity(roles);
    expect(screen.queryByRole("button", { name: "탈퇴 진행" })).not.toBeInTheDocument();
  });
});

describe("MyPageView phone editing", () => {
  it("formats the server value without treating separators as a change", () => {
    render(<MyPageView user={{ ...user(["GENERAL_USER"]), phone: "01012345678" }} initialEditing onSave={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: /전화번호/ })).toHaveValue("010-1234-5678");
    expect(screen.getByRole("button", { name: "변경사항 저장" })).toBeDisabled();
  });

  it("formats pasted input and sends only the formatted phone", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<MyPageView user={{ ...user(["GENERAL_USER"]), phone: "01011112222" }} initialEditing onSave={onSave} />);
    const input = screen.getByRole("textbox", { name: /전화번호/ });
    fireEvent.change(input, { target: { value: "+82 10 1234 5678", selectionStart: 16 } });
    expect(input).toHaveValue("+82 10-1234-5678");
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ phone: "+82 10-1234-5678" }));
  });

  it("delays an incomplete phone error until blur and blocks saving", () => {
    render(<MyPageView user={user(["GENERAL_USER"])} initialEditing onSave={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: /전화번호/ });
    fireEvent.change(input, { target: { value: "0101234", selectionStart: 7 } });
    expect(screen.queryByText("전화번호 형식을 확인해 주세요")).not.toBeInTheDocument();
    fireEvent.blur(input);
    expect(screen.getByText("전화번호 형식을 확인해 주세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "변경사항 저장" })).toBeDisabled();
  });

  it("keeps the explicit phone deletion contract", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<MyPageView user={{ ...user(["GENERAL_USER"]), phone: "01012345678" }} initialEditing onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "등록된 전화번호 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "전화번호 삭제" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ phone: null }));
  });
});
