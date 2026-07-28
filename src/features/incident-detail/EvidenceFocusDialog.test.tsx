// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceFocusDialog } from "./EvidenceFocusDialog";
import type { IncidentEvidence } from "./incidentDetailTypes";

const evidence = (id: string, representative = false): IncidentEvidence => ({
  detection_public_id: id,
  detected_at: "2026-07-19T05:25:03Z",
  object_category: "DEBRIS",
  class_code: "BOX",
  class_name: "박스",
  confidence: id === "evidence-1" ? 0.84 : 0.87,
  is_representative: representative,
  bbox: { x: 0.5, y: 0.65, width: 0.057, height: 0.075 },
  original_image_url: "/images/incidents/cam04-box-highway-v2.png",
  annotated_image_url: null,
  risk: {
    risk_score: 64.8,
    risk_grade: "MEDIUM",
    duration_ms: 5100,
    repeat_count: 11,
    track_id: "track-box",
    reason_codes: [],
  },
});

describe("EvidenceFocusDialog", () => {
  afterEach(cleanup);

  it("keeps incident context, viewing modes, evidence navigation, and consolidated zoom controls in the app", () => {
    const onSelect = vi.fn();
    const onView = vi.fn();
    render(
      <EvidenceFocusDialog
        incidentNo="INC-20260719-0007"
        evidences={[evidence("evidence-1", true), evidence("evidence-2")]}
        selectedId="evidence-1"
        view="annotated"
        onSelect={onSelect}
        onView={onView}
        onClose={vi.fn()}
        renderVisual={(item, view) => <div>{item.detection_public_id}:{view}</div>}
      />,
    );

    expect(screen.getByRole("dialog", { name: /INC-20260719-0007 · 박스/ })).toBeInTheDocument();
    expect(screen.getByText("evidence-1:annotated")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "결과 비교" }));
    expect(onView).toHaveBeenCalledWith("compare");
    fireEvent.click(screen.getByRole("button", { name: /다음 근거/ }));
    expect(onSelect).toHaveBeenCalledWith("evidence-2");
    expect(screen.queryByRole("button",{name:"화면 맞춤"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"초기화"})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"전체 보기"})).toHaveAttribute("aria-haspopup","menu");
    expect(screen.getByRole("button",{name:"전체 보기"})).toHaveAttribute("aria-expanded","false");
    fireEvent.click(screen.getByRole("button", { name: "이미지 확대" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens the view menu, exposes every mode once, and applies exact manual zoom values", () => {
    render(
      <EvidenceFocusDialog
        incidentNo="INC-20260719-0007"
        evidences={[evidence("evidence-1", true)]}
        selectedId="evidence-1"
        view="annotated"
        onSelect={vi.fn()}
        onView={vi.fn()}
        onClose={vi.fn()}
        renderVisual={() => <div>탐지 결과</div>}
      />,
    );

    fireEvent.click(screen.getByRole("button",{name:"전체 보기"}));
    const menu=screen.getByRole("menu",{name:"이미지 보기 설정"});
    expect(menu).toHaveAttribute("id","evidence-view-menu");
    expect(screen.getByRole("menuitemradio",{name:"전체 보기"})).toHaveAttribute("aria-checked","true");
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(8);
    expect(screen.getByRole("menuitemradio",{name:"실제 크기 100%"})).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio",{name:"100%"})).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemradio",{name:"150%"}));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"150%"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"이미지 확대"}));
    expect(screen.getByRole("button",{name:"200%"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"이미지 확대"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"이미지 축소"}));
    expect(screen.getByRole("button",{name:"150%"})).toBeInTheDocument();
  });

  it("supports menu keyboard navigation, Escape focus restoration, and outside dismissal", async () => {
    const onClose=vi.fn();
    render(
      <EvidenceFocusDialog
        incidentNo="INC-20260719-0007"
        evidences={[evidence("evidence-1", true)]}
        selectedId="evidence-1"
        view="annotated"
        onSelect={vi.fn()}
        onView={vi.fn()}
        onClose={onClose}
        renderVisual={() => <div>탐지 결과</div>}
      />,
    );

    const trigger=screen.getByRole("button",{name:"전체 보기"});
    fireEvent.click(trigger);
    await waitFor(()=>expect(screen.getByRole("menuitemradio",{name:"전체 보기"})).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("menu"),{key:"End"});
    expect(screen.getByRole("menuitemradio",{name:"200%"})).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"),{key:"ArrowUp"});
    expect(screen.getByRole("menuitemradio",{name:"150%"})).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"),{key:"Escape"});
    await waitFor(()=>expect(trigger).toHaveFocus());
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps a manual zoom when evidence changes and recenters the canvas", () => {
    const props={
      incidentNo:"INC-20260719-0007",
      evidences:[evidence("evidence-1",true),evidence("evidence-2")],
      view:"compare" as const,
      onSelect:vi.fn(),
      onView:vi.fn(),
      onClose:vi.fn(),
      renderVisual:(item:IncidentEvidence)=><div>{item.detection_public_id}</div>,
    };
    const {rerender,container}=render(<EvidenceFocusDialog {...props} selectedId="evidence-1"/>);
    fireEvent.click(screen.getByRole("button",{name:"전체 보기"}));
    fireEvent.click(screen.getByRole("menuitemradio",{name:"150%"}));
    rerender(<EvidenceFocusDialog {...props} selectedId="evidence-2"/>);
    expect(screen.getByRole("button",{name:"150%"})).toBeInTheDocument();
    expect(container.querySelector(".evidence-focus__transform")).toHaveStyle({transform:"translate3d(0px, 0px, 0) scale(1.5)"});
  });

  it("closes with Escape and traps keyboard focus within the modal", () => {
    const onClose = vi.fn();
    render(
      <EvidenceFocusDialog
        incidentNo="INC-20260719-0007"
        evidences={[evidence("evidence-1", true)]}
        selectedId="evidence-1"
        view="original"
        onSelect={vi.fn()}
        onView={vi.fn()}
        onClose={onClose}
        renderVisual={() => <div>원본 프레임</div>}
      />,
    );

    expect(screen.getByRole("button", { name: "집중 검토 닫기" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables unavailable previous and next navigation at list boundaries", () => {
    render(
      <EvidenceFocusDialog
        incidentNo="INC-20260719-0007"
        evidences={[evidence("evidence-1", true)]}
        selectedId="evidence-1"
        view="original"
        onSelect={vi.fn()}
        onView={vi.fn()}
        onClose={vi.fn()}
        renderVisual={() => <div>원본 프레임</div>}
      />,
    );
    expect(screen.getByRole("button", { name: /이전 근거/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /다음 근거/ })).toBeDisabled();
  });
});
