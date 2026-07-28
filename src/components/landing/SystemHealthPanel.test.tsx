// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SystemHealthPanel } from "./SystemHealthPanel";

const defaultProps = {
  open: true,
  status: "healthy" as const,
  api: true,
  database: true,
  checkedAt: "2026-07-23T03:32:43.000Z",
  isLoading: false,
  onRefresh: vi.fn(),
  onClose: vi.fn(),
};

afterEach(cleanup);

describe("SystemHealthPanel", () => {
  it("refreshes once when opened and refreshes again when reopened", () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<SystemHealthPanel {...defaultProps} onRefresh={onRefresh} />);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(<SystemHealthPanel {...defaultProps} open={false} onRefresh={onRefresh} />);
    rerender(<SystemHealthPanel {...defaultProps} open onRefresh={onRefresh} />);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("shows healthy rows without the old footer or retry actions", () => {
    const { container } = render(<SystemHealthPanel {...defaultProps} />);

    expect(screen.getByRole("dialog", { name: "도로보GO 서버 상태" })).toBeInTheDocument();
    expect(screen.getAllByText("정상")).toHaveLength(2);
    expect(container.querySelectorAll(".system-health-panel__row-main.is-healthy > i[aria-hidden='true']")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "다시 확인" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "재시도" })).not.toBeInTheDocument();
    expect(screen.getByText(/마지막 확인/)).toBeInTheDocument();
  });

  it("uses an accessible two-arrow refresh icon and blocks duplicate clicks while loading", () => {
    const onRefresh = vi.fn();
    const { container } = render(<SystemHealthPanel {...defaultProps} isLoading onRefresh={onRefresh} />);
    const refresh = screen.getByRole("button", { name: "서버 상태 새로고침" });

    expect(refresh).toBeDisabled();
    expect(refresh).toHaveAttribute("aria-busy", "true");
    expect(refresh).toHaveAttribute("title", "서버 상태 새로고침");
    expect(refresh.querySelector("svg")).toHaveClass("is-spinning");
    expect(refresh.querySelectorAll("path")).toHaveLength(4);
    expect(screen.getAllByText("확인 중")).toHaveLength(2);
    expect(screen.getByText("서버 상태를 확인하고 있습니다")).toBeInTheDocument();

    fireEvent.click(refresh);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector("footer")).not.toBeInTheDocument();
  });

  it("keeps healthy and failed services distinct and retries with the existing refresh callback", () => {
    const onRefresh = vi.fn();
    render(<SystemHealthPanel {...defaultProps} status="degraded" database={false} onRefresh={onRefresh} />);

    expect(screen.getByText("정상")).toBeInTheDocument();
    expect(screen.getByText("점검 필요")).toBeInTheDocument();
    expect(screen.getByText("데이터베이스 상태를 확인할 수 없습니다.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "재시도" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "재시도" }));
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("closes with Escape and restores focus to the opener", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<SystemHealthPanel {...defaultProps} onClose={onClose} />);

    expect(screen.getByRole("button", { name: "서버 상태 닫기" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
