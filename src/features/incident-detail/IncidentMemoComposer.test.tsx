// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentMemoComposer } from "./IncidentMemoComposer";
import { memoDraftStorageKey } from "./incidentMemoDraft";

const props={incidentPublicId:"incident-a",memos:[],editingMemo:null,busy:false,error:"",onSubmit:vi.fn(),onClose:vi.fn()};
const editingMemo={public_id:"memo-a",incident_public_id:"incident-a",memo_type:"REVIEW" as const,content:"원본 메모",created_by:{public_id:"controller",user_name:"관제자"},created_at:"2026-07-28T00:00:00Z"};
const editingProps={...props,editingMemo};

describe("IncidentMemoComposer",()=>{
  beforeEach(()=>{sessionStorage.clear();props.onSubmit.mockReset();props.onClose.mockReset()});
  afterEach(cleanup);

  it("starts with free writing and submits GENERAL content unchanged",()=>{
    render(<IncidentMemoComposer {...props}/>);
    expect(screen.getByRole("dialog").parentElement).toHaveClass("memo-dialog-backdrop");
    expect(screen.getByRole("dialog").parentElement?.parentElement).toBe(document.body);
    expect(screen.getByRole("radio",{name:"일반"})).toHaveAttribute("aria-checked","true");
    fireEvent.change(screen.getByLabelText("메모 내용"),{target:{value:"자유 메모\n둘째 줄"}});
    fireEvent.click(screen.getByRole("button",{name:"메모 등록"}));
    expect(props.onSubmit).toHaveBeenCalledWith("GENERAL","자유 메모\n둘째 줄");
  });

  it("retains values per mode and composes structured content without empty sections",()=>{
    render(<IncidentMemoComposer {...props}/>);
    fireEvent.change(screen.getByLabelText("메모 내용"),{target:{value:"자유 메모"}});
    fireEvent.click(screen.getByRole("radio",{name:"검토 기록"}));
    fireEvent.change(screen.getByLabelText("확인한 내용"),{target:{value:"원본 확인"}});
    fireEvent.change(screen.getByLabelText("추가 확인 사항"),{target:{value:"후속 확인"}});
    fireEvent.click(screen.getByRole("radio",{name:"일반"}));
    expect(screen.getByLabelText("메모 내용")).toHaveValue("자유 메모");
    fireEvent.click(screen.getByRole("radio",{name:"검토 기록"}));
    fireEvent.click(screen.getByRole("button",{name:"메모 등록"}));
    expect(props.onSubmit).toHaveBeenCalledWith("REVIEW","[확인한 내용]\n원본 확인\n\n[추가 확인 사항]\n후속 확인");
  });

  it("restores only the current incident draft and supports Ctrl+Enter",()=>{
    sessionStorage.setItem(memoDraftStorageKey("incident-a"),JSON.stringify({type:"DISPATCH",values:{GENERAL:[""],REVIEW:["","",""],DISPATCH:["현장 상황","",""],CLOSURE:["","",""]}}));
    sessionStorage.setItem(memoDraftStorageKey("incident-b"),JSON.stringify({type:"GENERAL",values:{GENERAL:["다른 사건"],REVIEW:["","",""],DISPATCH:["","",""],CLOSURE:["","",""]}}));
    render(<IncidentMemoComposer {...props}/>);
    expect(screen.getByRole("radio",{name:"출동 전달"})).toHaveAttribute("aria-checked","true");
    expect(screen.getByLabelText("현장 상황")).toHaveValue("현장 상황");
    fireEvent.keyDown(document,{key:"Enter",ctrlKey:true});
    expect(props.onSubmit).toHaveBeenCalledWith("DISPATCH","[현장 상황]\n현장 상황");
  });

  it("blocks blank and over-limit content and offers draft close choices",()=>{
    render(<IncidentMemoComposer {...props}/>);
    expect(screen.getByRole("button",{name:"메모 등록"})).toBeDisabled();
    fireEvent.change(screen.getByLabelText("메모 내용"),{target:{value:"가".repeat(2001)}});
    expect(screen.getByRole("button",{name:"메모 등록"})).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("2,000자를 초과");
    fireEvent.click(screen.getByRole("button",{name:"취소"}));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"작성 내용 버리기"}));
    expect(sessionStorage.getItem(memoDraftStorageKey("incident-a"))).toBeNull();
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("warns before cancelling a changed memo correction and keeps the editor open",()=>{
    render(<IncidentMemoComposer {...editingProps}/>);
    fireEvent.change(screen.getByLabelText("메모 내용"),{target:{value:"변경한 메모"}});
    fireEvent.click(screen.getByRole("button",{name:"취소"}));
    expect(screen.getByRole("alertdialog",{name:"수정 중인 내용이 있습니다"})).toHaveTextContent("저장하지 않고 닫으면 변경한 내용이 사라집니다.");
    expect(screen.getByRole("dialog",{name:"관제 메모 정정"})).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("applies the correction warning to the close button, Escape, and backdrop",()=>{
    const {unmount}=render(<IncidentMemoComposer {...editingProps}/>);
    fireEvent.change(screen.getByLabelText("메모 내용"),{target:{value:"닫기 변경"}});
    fireEvent.click(screen.getByRole("button",{name:"관제 메모 창 닫기"}));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.keyDown(document,{key:"Escape"});
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("메모 내용")).toHaveValue("닫기 변경");
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document,{key:"Escape"});
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    unmount();

    render(<IncidentMemoComposer {...editingProps}/>);
    fireEvent.change(screen.getByLabelText("메모 내용"),{target:{value:"배경 변경"}});
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("continues a correction with its content and focus intact",async()=>{
    render(<IncidentMemoComposer {...editingProps}/>);
    const textarea=screen.getByLabelText("메모 내용");
    fireEvent.change(textarea,{target:{value:"계속 수정할 내용"}});
    fireEvent.click(screen.getByRole("button",{name:"취소"}));
    expect(screen.getByRole("button",{name:"계속 수정"})).toHaveFocus();
    fireEvent.keyDown(document,{key:"Tab",shiftKey:true});
    expect(screen.getByRole("button",{name:"변경 내용 버리기"})).toHaveFocus();
    fireEvent.keyDown(document,{key:"Tab"});
    expect(screen.getByRole("button",{name:"계속 수정"})).toHaveFocus();
    fireEvent.click(screen.getByRole("button",{name:"계속 수정"}));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(textarea).toHaveValue("계속 수정할 내용");
    await waitFor(()=>expect(textarea).toHaveFocus());
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("discards only the unsaved correction without submitting",()=>{
    render(<IncidentMemoComposer {...editingProps}/>);
    fireEvent.change(screen.getByLabelText("메모 내용"),{target:{value:"버릴 변경"}});
    fireEvent.click(screen.getByRole("button",{name:"취소"}));
    fireEvent.click(screen.getByRole("button",{name:"변경 내용 버리기"}));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(editingMemo.content).toBe("원본 메모");
  });

  it("closes an unchanged correction immediately and treats trimmed structured content as unchanged",()=>{
    const {unmount}=render(<IncidentMemoComposer {...editingProps}/>);
    fireEvent.click(screen.getByRole("button",{name:"취소"}));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(props.onClose).toHaveBeenCalledOnce();
    unmount();
    props.onClose.mockReset();

    render(<IncidentMemoComposer {...editingProps} editingMemo={{...editingMemo,content:"원본 메모  "}}/>);
    fireEvent.click(screen.getByRole("button",{name:"취소"}));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("treats a memo type-only correction as an unsaved change",()=>{
    render(<IncidentMemoComposer {...editingProps}/>);
    fireEvent.click(screen.getByRole("radio",{name:"출동 전달"}));
    fireEvent.click(screen.getByRole("button",{name:"취소"}));
    expect(screen.getByRole("alertdialog",{name:"수정 중인 내용이 있습니다"})).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
