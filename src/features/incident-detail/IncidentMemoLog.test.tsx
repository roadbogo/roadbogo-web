// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncidentMemo, IncidentMemoType } from "./incidentDetailTypes";
import { IncidentMemoLog } from "./IncidentCommandWorkspace";

const memo = (publicId:string,type:IncidentMemoType,content:string,createdAt:string):IncidentMemo=>({
  public_id:publicId,
  incident_public_id:"incident-1",
  memo_type:type,
  content,
  created_by:{public_id:`user-${publicId}`,user_name:`작성자 ${publicId}`},
  created_at:createdAt,
});

const memos=[
  memo("review","REVIEW","검토 기록","2026-07-20T05:00:00Z"),
  memo("closure","CLOSURE","종료 기록","2026-07-19T05:00:00Z"),
  memo("general","GENERAL","새 일반 기록","2026-07-23T05:00:00Z"),
  memo("dispatch","DISPATCH","출동 기록과 very-long-token-1234567890-abcdefghijklmnopqrstuvwxyz","2026-07-21T05:00:00Z"),
];

afterEach(cleanup);

describe("IncidentMemoLog",()=>{
  it("renders a newest-first single-column log with one latest marker",()=>{
    const{container}=render(<IncidentMemoLog memos={memos}/>);
    const articles=[...container.querySelectorAll(".memo-list article")];
    expect(articles).toHaveLength(4);
    expect(articles.map(article=>article.getAttribute("data-memo-type"))).toEqual(["GENERAL","DISPATCH","REVIEW","CLOSURE"]);
    expect(within(articles[0] as HTMLElement).getByText("최근 메모")).toBeInTheDocument();
    expect(screen.getAllByText("최근 메모")).toHaveLength(1);
    expect(container.querySelector(".memo-list")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/수정|삭제/})).not.toBeInTheDocument();
  });

  it("shows accurate counts and filters every supported memo type",()=>{
    render(<IncidentMemoLog memos={memos}/>);
    for(const label of ["전체 4","일반 1","검토 기록 1","출동 전달 1","종료 참고 1"])expect(screen.getByRole("button",{name:label})).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button",{name:"출동 전달 1"}));
    expect(screen.getByText(/출동 기록과/)).toBeInTheDocument();
    expect(screen.queryByText("새 일반 기록")).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"출동 전달 1"})).toHaveAttribute("aria-pressed","true");
  });

  it("shows a filter-specific empty state",()=>{
    render(<IncidentMemoLog memos={[memos[0]]}/>);
    fireEvent.click(screen.getByRole("button",{name:"출동 전달 0"}));
    expect(screen.getByText("해당 유형의 관제 메모가 없습니다")).toBeInTheDocument();
  });

  it("shows the empty memo guidance",()=>{
    render(<IncidentMemoLog memos={[]}/>);
    expect(screen.getByText("아직 등록된 관제 메모가 없습니다")).toBeInTheDocument();
    expect(screen.getByText("사건 판단 근거나 전달 사항을 기록해 주세요")).toBeInTheDocument();
  });
  it("shows actions only for the current user's active memo and hides deleted content",()=>{
    const onEdit=vi.fn();
    const deleted={...memos[1],deleted_at:"2026-07-23T06:00:00Z",deleted_by:{public_id:"deleter",user_name:"삭제자"},delete_reason:"잘못 등록"};
    render(<IncidentMemoLog memos={[memos[0],memos[2],deleted]} userPublicId="user-general" canManage onEdit={onEdit}/>);
    expect(screen.getAllByRole("button",{name:/메모 메뉴/})).toHaveLength(1);
    expect(screen.getByText("삭제된 메모입니다")).toBeInTheDocument();
    expect(screen.queryByText("종료 기록")).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"전체 2"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"일반 메모 메뉴"}));
    fireEvent.click(screen.getByRole("menuitem",{name:"메모 정정"}));
    expect(onEdit).toHaveBeenCalledWith(memos[2]);
  });
});
