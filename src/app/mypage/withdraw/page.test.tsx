// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WithdrawalPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

describe("WithdrawalPage", () => {
  it("replaces the legacy route with mypage", async () => {
    render(<WithdrawalPage />);
    expect(screen.getByRole("status")).toHaveTextContent("마이페이지로 이동하고 있습니다.");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mypage"));
  });
});
