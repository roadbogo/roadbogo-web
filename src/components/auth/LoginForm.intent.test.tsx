// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoginIntent } from "@/types/auth";
import { LoginForm } from "./LoginForm";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  replace: vi.fn(),
  setAuthenticatedUser: vi.fn(),
}));

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/auth/AuthContext", () => ({ useAuth: () => ({ ready: true, setAuthenticatedUser: mocks.setAuthenticatedUser }) }));
vi.mock("@/lib/authApi", () => ({
  authApi: { login: mocks.login, logout: mocks.logout },
  toAuthUser: (user: {
    public_id: string;
    email: string;
    user_name: string;
    phone: string | null;
    account_status: string;
    organization: null;
    roles: string[];
    permissions: string[];
    last_login_at: string | null;
    updated_at: string;
  }) => ({
    publicId: user.public_id,
    email: user.email,
    userName: user.user_name,
    phone: user.phone ?? undefined,
    accountStatus: user.account_status,
    organization: user.organization,
    roles: user.roles,
    permissions: user.permissions,
    lastLoginAt: user.last_login_at,
    updatedAt: user.updated_at,
  }),
}));

const account = (roles: string[]) => ({
  access_token: "access-token",
  token_type: "Bearer",
  expires_in: 900,
  user: {
    public_id: "user-1",
    email: "user@example.com",
    user_name: "테스트 사용자",
    phone: null,
    account_status: "ACTIVE",
    organization: null,
    roles,
    permissions: [],
    last_login_at: null,
    updated_at: "2026-07-23T00:00:00Z",
  },
});

function IntentForm({ intent }: { intent: LoginIntent }) {
  return <LoginForm key={intent} intent={intent} />;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/login");
  sessionStorage.clear();
  mocks.login.mockReset();
  mocks.logout.mockReset();
  mocks.replace.mockReset();
  mocks.setAuthenticatedUser.mockReset();
});

afterEach(cleanup);

describe("LoginForm intent isolation", () => {
  it("uses separate field identifiers and autocomplete sections", () => {
    const { rerender } = render(<IntentForm intent="general" />);
    const generalEmail = screen.getByLabelText("이메일");
    const generalPassword = screen.getByLabelText("비밀번호");

    expect(generalEmail).toHaveAttribute("id", "login-general-email");
    expect(generalEmail).toHaveAttribute("name", "login-general-email");
    expect(generalEmail).toHaveAttribute("autocomplete", "section-general username");
    expect(generalPassword).toHaveAttribute("id", "login-general-password");
    expect(generalPassword).toHaveAttribute("name", "login-general-password");
    expect(generalPassword).toHaveAttribute("autocomplete", "section-general current-password");

    rerender(<IntentForm intent="operations" />);
    expect(screen.getByLabelText("이메일")).toHaveAttribute("id", "login-operations-email");
    expect(screen.getByLabelText("이메일")).toHaveAttribute("name", "login-operations-email");
    expect(screen.getByLabelText("이메일")).toHaveAttribute("autocomplete", "section-operations username");
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("id", "login-operations-password");
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("name", "login-operations-password");
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("autocomplete", "section-operations current-password");
  });

  it("resets local form, validation, remember-me, and password visibility on intent change", () => {
    const { rerender } = render(<IntentForm intent="general" />);
    const email = screen.getByLabelText("이메일");
    const password = screen.getByLabelText("비밀번호");
    const remember = screen.getByLabelText("로그인 상태 유지");

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(email).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(email, { target: { value: "general@example.com" } });
    fireEvent.change(password, { target: { value: "secret-password" } });
    fireEvent.click(remember);
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 표시" }));
    expect(password).toHaveAttribute("type", "text");

    rerender(<IntentForm intent="operations" />);
    expect(screen.getByLabelText("이메일")).toHaveValue("");
    expect(screen.getByLabelText("이메일")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText("로그인 상태 유지")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "비밀번호 표시" })).toHaveAttribute("aria-pressed", "false");
  });

  it("clears the operations access mismatch when switching intents", async () => {
    mocks.login.mockResolvedValueOnce(account(["GENERAL_USER"]));
    const { rerender } = render(<IntentForm intent="operations" />);

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secret-password" } });
    fireEvent.click(screen.getByLabelText("로그인 상태 유지"));
    fireEvent.click(screen.getByRole("button", { name: "운영 계정으로 로그인" }));

    expect(await screen.findByText("운영 시스템 접근 권한이 없습니다.")).toBeInTheDocument();
    expect(mocks.login).toHaveBeenCalledWith("user@example.com", "secret-password", true);

    rerender(<IntentForm intent="general" />);
    expect(screen.queryByText("운영 시스템 접근 권한이 없습니다.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toHaveValue("");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
  });

  it("keeps successful operations authentication on the existing login contract", async () => {
    mocks.login.mockResolvedValueOnce(account(["CONTROLLER"]));
    render(<IntentForm intent="operations" />);

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "controller@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secret-password" } });
    fireEvent.click(screen.getByRole("button", { name: "운영 계정으로 로그인" }));

    await waitFor(() => expect(mocks.setAuthenticatedUser).toHaveBeenCalledTimes(1));
    expect(mocks.login).toHaveBeenCalledWith("controller@example.com", "secret-password", false);
    expect(screen.queryByText("운영 시스템 접근 권한이 없습니다.")).not.toBeInTheDocument();
  });
});
