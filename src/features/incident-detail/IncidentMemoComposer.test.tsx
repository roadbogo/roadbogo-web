// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentMemoComposer } from "./IncidentMemoComposer";
import { memoDraftStorageKey } from "./incidentMemoDraft";

const props={incidentPublicId:"incident-a",memos:[],editingMemo:null,busy:false,error:"",onSubmit:vi.fn(),onClose:vi.fn()};

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
});
