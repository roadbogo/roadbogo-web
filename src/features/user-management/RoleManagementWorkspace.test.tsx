// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/roles", useRouter: () => ({ replace: navigation.replace, push: navigation.push }), useSearchParams: () => navigation.params }));
vi.mock("@/components/auth/AuthContext", () => ({ useAuth: () => ({ user: { publicId: "admin", role: "SYSTEM_ADMIN", roles: ["SYSTEM_ADMIN"], apiPermissions: ["ROLE.MANAGE"] } }) }));
vi.mock("./mockUserManagementAdapter", async importOriginal => {
  const actual = await importOriginal<typeof import("./mockUserManagementAdapter")>();
  return { ...actual, createUserManagementAdapter: () => new actual.MockUserManagementAdapter() };
});
import { RoleManagementWorkspace } from "./RoleManagementWorkspace";

beforeEach(() => { navigation.params = new URLSearchParams(); navigation.replace.mockClear(); navigation.push.mockClear(); localStorage.clear(); });
afterEach(cleanup);

describe("RoleManagementWorkspace", () => {
  it("opens with the assignment list and keeps the matrix in a read-only tab", async () => {
    render(<RoleManagementWorkspace />);
    expect(screen.getByRole("tab", { name: "역할 배정" })).toHaveAttribute("aria-selected", "true");
    await screen.findByRole("columnheader", { name: "현재 역할" });
    expect(screen.queryByRole("columnheader", { name: /시스템 관리자/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "배정 현황" }));
    expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("tab=matrix"), { scroll: false });
  });

  it("renders the matrix as a ten-row read-only view with shared role presentation",async()=>{
    navigation.params=new URLSearchParams("tab=matrix");
    render(<RoleManagementWorkspace/>);
    expect(screen.getByRole("tab",{name:"배정 현황"})).toHaveAttribute("aria-selected","true");
    expect(await screen.findByRole("heading",{name:"사용자별 역할 배정 현황"})).toBeInTheDocument();
    expect(screen.getByText("각 사용자에게 부여된 역할과 서비스 접근 범위를 확인합니다.")).toBeInTheDocument();
    expect((await screen.findAllByText("배정됨")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByRole("button",{name:/10명 표시/})).toBeInTheDocument();
    expect(screen.getByText("전체 27명 · 1–10명 표시")).toBeInTheDocument();
  });

  it("moves page size and density into the accessible view settings popover",async()=>{
    navigation.params=new URLSearchParams("tab=matrix");
    render(<RoleManagementWorkspace/>);
    await screen.findAllByText("배정됨");
    fireEvent.click(screen.getByRole("button",{name:"보기 설정"}));
    const settings=screen.getByRole("dialog",{name:"보기 설정"});
    expect(within(settings).getByRole("button",{name:"10명"})).toHaveAttribute("aria-pressed","true");
    expect(within(settings).getByRole("checkbox",{name:"사용자·소속 열 고정"})).toBeChecked();
    fireEvent.click(within(settings).getByRole("button",{name:"20명"}));
    expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("size=20"),{scroll:false});
  });

  it("maps view=unassigned to the summary filter and keeps it in URL updates", async () => {
    navigation.params = new URLSearchParams("view=unassigned");
    render(<RoleManagementWorkspace />);
    const filter = screen.getByRole("button", { name: /역할 미지정/ });
    expect(filter).toHaveAttribute("aria-pressed", "true");
    await screen.findByRole("columnheader", { name: "현재 역할" });
  });

  it("opens the role drawer and presents a confirmation dialog before saving", async () => {
    render(<RoleManagementWorkspace />);
    await screen.findByRole("columnheader", { name: "현재 역할" });
    const manage = screen.getAllByRole("button", { name: /역할 설정/ }).find(button => button.textContent?.includes("역할 설정"));
    expect(manage).toBeDefined();
    fireEvent.click(manage!);
    expect(navigation.push).toHaveBeenCalledWith(expect.stringMatching(/user=/), { scroll: false });

    const userId = new URL(navigation.push.mock.calls[0][0], "http://localhost").searchParams.get("user");
    navigation.params = new URLSearchParams(`user=${userId}`);
    cleanup();
    render(<RoleManagementWorkspace />);
    const drawer = await screen.findByRole("dialog", { name: "역할 관리" });
    const roleCards = within(drawer).getAllByRole("checkbox");
    fireEvent.click(roleCards.find(input => !input.hasAttribute("checked")) ?? roleCards[0]);
    fireEvent.click(within(drawer).getByRole("button", { name: "역할 저장" }));
    expect(screen.getByRole("alertdialog", { name: "역할을 변경하시겠습니까?" })).toBeInTheDocument();
  });

  it("clears an unknown selected user from the URL", async () => {
    navigation.params = new URLSearchParams("user=missing-user");
    render(<RoleManagementWorkspace />);
    await waitFor(() => expect(screen.getByText("선택한 사용자를 찾을 수 없습니다.")).toBeInTheDocument());
    expect(navigation.replace).toHaveBeenCalled();
  });
});
