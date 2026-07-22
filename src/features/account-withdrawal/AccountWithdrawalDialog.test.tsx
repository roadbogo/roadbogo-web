// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { AccountWithdrawalDialog } from "./AccountWithdrawalDialog";

const mocks = vi.hoisted(() => ({ clearAuth: vi.fn(), withdraw: vi.fn(), replace: vi.fn(), finish: vi.fn(), clearRouting: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/auth/AuthContext", () => ({ useAuth: () => ({ clearAuth: mocks.clearAuth }) }));
vi.mock("./accountWithdrawal", () => ({ createAccountWithdrawalAdapter: () => ({ withdraw: mocks.withdraw }) }));
vi.mock("@/lib/auth/postLoginRouting", () => ({ clearPostLoginRoutingState: mocks.clearRouting }));
vi.mock("@/lib/apiClient", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/apiClient")>(), finishLogoutSession: mocks.finish }));

const user: AuthenticatedUser = { publicId: "user-1", name: "긴 이름의 일반 사용자", role: "GENERAL_USER", roles: ["GENERAL_USER"], email: "withdrawal-user@example.test", accountStatus: "ACTIVE", apiPermissions: [], uiRoles: [], uiPermissions: [] };
const renderDialog = () => render(<><button ref={createRef<HTMLButtonElement>()}>trigger</button><AccountWithdrawalDialog open user={user} triggerRef={createRef<HTMLButtonElement>()} onClose={vi.fn()} /></>);
const goToPassword = () => { fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "계속" })); };

beforeEach(() => { mocks.withdraw.mockReset().mockResolvedValue(null); mocks.clearAuth.mockClear(); mocks.replace.mockClear(); mocks.finish.mockClear(); mocks.clearRouting.mockClear(); window.requestAnimationFrame = callback => { callback(0); return 0; }; });
afterEach(cleanup);

describe("AccountWithdrawalDialog", () => {
  it("keeps the complete notice copy and toggles confirmation from the label", () => {
    renderDialog();
    expect(screen.getByText("회원 탈퇴 전에 확인해 주세요")).toBeInTheDocument();
    expect(screen.getByText("아래 내용을 확인한 후 다음 단계로 진행해 주세요")).toBeInTheDocument();
    for (const copy of [
      "탈퇴한 계정은 다시 복구할 수 없습니다",
      "현재 기기를 포함한 모든 기기에서 로그아웃됩니다",
      "같은 이메일로 다시 이용하려면 새로 회원가입해야 합니다",
      "서비스 운영에 필요한 일부 기록은 개인정보를 제거한 형태로 보관될 수 있습니다",
    ]) expect(screen.getByText(copy)).toBeInTheDocument();
    fireEvent.click(screen.getByText("위 내용을 모두 확인했으며, 탈퇴 후에는 계정을 복구할 수 없다는 점을 이해했습니다"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: "계속" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "회원 탈퇴 창 닫기" })).toHaveLength(2);
  });

  it("requires confirmation and a current password", () => {
    renderDialog();
    const next = screen.getByRole("button", { name: "계속" });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(next).toBeEnabled(); fireEvent.click(next);
    expect(screen.getByLabelText("현재 비밀번호")).toHaveFocus();
    expect(screen.getByRole("button", { name: "회원 탈퇴" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이전 단계로 돌아가기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이전" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  it("keeps one password input focused while typing and toggling visibility", () => {
    renderDialog(); goToPassword();
    const input = screen.getByLabelText("현재 비밀번호");
    for (const value of ["P", "Pa", "Pas", "Password123456789!"]) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveFocus();
      expect(input).toHaveValue(value);
    }
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 표시" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("Password123456789!");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "Password123456789!+" } });
    expect(input).toHaveValue("Password123456789!+");
  });

  it("keeps confirmation but clears password when returning to the notice step", () => {
    renderDialog(); goToPassword();
    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "sensitive" } });
    fireEvent.click(screen.getByRole("button", { name: "이전 단계로 돌아가기" }));
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "계속" }));
    expect(screen.getByLabelText("현재 비밀번호")).toHaveValue("");
    expect(screen.getByLabelText("현재 비밀번호")).toHaveAttribute("type", "password");
  });

  it("keeps the dialog open and focuses the field for an invalid password", async () => {
    mocks.withdraw.mockRejectedValueOnce(new ApiError("AUTH_CURRENT_PASSWORD_INVALID", "invalid", null, null, 401));
    renderDialog(); goToPassword();
    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
    expect(await screen.findByText("현재 비밀번호가 일치하지 않습니다")).toBeInTheDocument();
    expect(screen.getByLabelText("현재 비밀번호")).toHaveFocus();
    expect(mocks.clearAuth).not.toHaveBeenCalled();
  });

  it("blocks duplicate submission and clears authentication after success", async () => {
    let resolve!: (value: null) => void;
    mocks.withdraw.mockReturnValue(new Promise<null>(done => { resolve = done; }));
    renderDialog(); goToPassword();
    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "exact password" } });
    const submit = screen.getByRole("button", { name: "회원 탈퇴" });
    fireEvent.click(submit); fireEvent.submit(submit.closest("form")!);
    expect(mocks.withdraw).toHaveBeenCalledTimes(1); resolve(null);
    await waitFor(() => expect(mocks.clearAuth).toHaveBeenCalledTimes(1));
    expect(mocks.finish).toHaveBeenCalledTimes(1);
    expect(mocks.clearRouting).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("회원 탈퇴가 완료되었습니다")).toBeInTheDocument();
  });
});
