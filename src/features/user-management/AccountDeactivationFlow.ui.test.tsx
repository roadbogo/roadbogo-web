// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {AccountDeactivationFlow} from "./AccountDeactivationFlow";
import type {ManagedUser,UserManagementAdapter} from "./userManagementTypes";

const user:ManagedUser={publicId:"target-user",email:"target@roadbogo.kr",userName:"한관리 6",phone:null,accountStatus:"ACTIVE",organization:{publicId:"org",name:"중부고속도로 관제센터"},roles:["SYSTEM_ADMIN"],lastLoginAt:null,createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z",changes:[],activeAssignments:0};
const adapter=(allowed=true):UserManagementAdapter=>({
  checkDeactivation:vi.fn().mockResolvedValue(allowed?{user,allowed:true}:{user,allowed:false,blockReason:"ACTIVE_ASSIGNMENT",activeAssignments:2}),
  deactivateUser:vi.fn().mockResolvedValue({...user,accountStatus:"INACTIVE"}),
} as unknown as UserManagementAdapter);
afterEach(cleanup);

describe("AccountDeactivationFlow inspector mode",()=>{
  it("renders one review form without a modal and enables the danger action only after confirmation",async()=>{
    const service=adapter(),onSuccess=vi.fn();
    render(<AccountDeactivationFlow user={user} actorPublicId="another-admin" adapter={service} onClose={vi.fn()} onSuccess={onSuccess} onMissing={vi.fn()}/>);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("진행 중인 사건·출동 업무가 없습니다.")).toBeTruthy();
    const submit=screen.getByRole("button",{name:"계정 비활성화"});
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    const reasonButton=screen.getByRole("button",{name:"업무 변경"});
    fireEvent.click(reasonButton);
    expect(reasonButton.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByLabelText("대상 계정과 비활성화 영향을 확인했습니다."));
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(()=>expect(service.deactivateUser).toHaveBeenCalledWith("target-user",{reason:"업무 변경"}));
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({accountStatus:"INACTIVE"}));
  });

  it("hides reason and final action when active work blocks deactivation",async()=>{
    render(<AccountDeactivationFlow user={user} actorPublicId="another-admin" adapter={adapter(false)} onClose={vi.fn()} onSuccess={vi.fn()} onMissing={vi.fn()}/>);
    expect(await screen.findByText("계정을 비활성화할 수 없습니다.")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"사유 유형"})).toBeNull();
    expect(screen.queryByRole("button",{name:"계정 비활성화"})).toBeNull();
    expect(screen.getByText(/2건/)).toBeTruthy();
  });
});
