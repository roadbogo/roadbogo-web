// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoEntryBar } from "./IncidentCommandWorkspace";
import { IncidentMemoComposer } from "./IncidentMemoComposer";

describe("incident memo inline entry",()=>{
  afterEach(cleanup);

  it("uses a full-width writing entry without plus or arrow affordances",()=>{
    const onOpen=vi.fn();
    const {container}=render(<MemoEntryBar onOpen={onOpen}/>);
    const entry=screen.getByRole("button",{name:"관제 메모 작성"});
    expect(entry).toHaveTextContent("새로운 판단 근거나 전달 사항을 기록하세요");
    expect(entry).toHaveTextContent("메모 작성");
    expect(entry).not.toHaveTextContent("+");
    expect(entry).not.toHaveTextContent("→");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden","true");
    fireEvent.click(entry);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("renders the four-type composer inline in the same document flow",()=>{
    render(<IncidentMemoComposer inline incidentPublicId="incident-a" memos={[]} editingMemo={null} busy={false} error="" onSubmit={vi.fn()} onClose={vi.fn()}/>);
    expect(screen.getByRole("region",{name:"관제 메모 작성"})).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("radio",{name:"일반"})).toHaveAttribute("aria-checked","true");
  });
});
