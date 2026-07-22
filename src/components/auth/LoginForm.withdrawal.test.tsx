// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/auth/AuthContext", () => ({ useAuth: () => ({ ready: true, setAuthenticatedUser: vi.fn() }) }));

afterEach(cleanup);

describe("LoginForm withdrawal completion", () => {
  it("shows the completion banner once and consumes the URL reason", () => {
    window.history.replaceState(null, "", "/login?reason=withdrawn");
    const { unmount } = render(<LoginForm intent="general" />);
    expect(screen.getByText("회원 탈퇴가 완료되었습니다")).toBeInTheDocument();
    expect(screen.getByText("그동안 도로보GO를 이용해 주셔서 감사합니다.")).toBeInTheDocument();
    expect(window.location.search).toBe("");
    unmount();
    render(<LoginForm intent="general" />);
    expect(screen.queryByText("회원 탈퇴가 완료되었습니다")).not.toBeInTheDocument();
  });
});
