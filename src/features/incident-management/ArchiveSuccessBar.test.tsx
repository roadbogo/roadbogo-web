// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiveSuccessBar } from "./IncidentManagementPage";

describe("ArchiveSuccessBar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("announces the actual archived count and exposes only one follow-up result bar", () => {
    render(<ArchiveSuccessBar count={3} onView={vi.fn()} onDismiss={vi.fn()} />);
    const result = screen.getByRole("status");
    expect(result).toHaveTextContent("보관함으로 이동 완료");
    expect(result).toHaveTextContent("선택한 사건 3건이 보관함으로 이동되었습니다.");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByText(/실행 취소|되돌리기|복원/)).not.toBeInTheDocument();
  });

  it("opens the archive tab action and supports explicit dismissal", () => {
    const onView = vi.fn();
    const onDismiss = vi.fn();
    render(<ArchiveSuccessBar count={1} onView={onView} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "보관함 보기" }));
    expect(onView).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "보관함 이동 완료 안내 닫기" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("automatically closes after five seconds", () => {
    const onDismiss = vi.fn();
    render(<ArchiveSuccessBar count={1} onView={vi.fn()} onDismiss={onDismiss} />);
    vi.advanceTimersByTime(4999);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("pauses automatic dismissal while hovered or keyboard focus remains inside", () => {
    const onDismiss = vi.fn();
    render(<ArchiveSuccessBar count={1} onView={vi.fn()} onDismiss={onDismiss} />);
    const result = screen.getByRole("status");
    fireEvent.mouseEnter(result);
    vi.advanceTimersByTime(6000);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(result);
    vi.advanceTimersByTime(5000);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    onDismiss.mockClear();
    fireEvent.focus(screen.getByRole("button", { name: "보관함 보기" }));
    vi.advanceTimersByTime(6000);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
