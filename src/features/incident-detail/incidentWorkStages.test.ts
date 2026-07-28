import { describe, expect, it } from "vitest";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { createMockIncidentDetailRecord } from "./mockIncidentDetailAdapter";
import { currentIncidentWorkStage, getIncidentWorkStages, incidentWorkStageFlow } from "./incidentWorkStages";
import type { IncidentDetailRecord } from "./incidentDetailTypes";

function record(status: IncidentDetailRecord["incident"]["status"]) {
  const publicId = createMockDashboardSnapshot().incidents[0].public_id;
  const fixture = createMockIncidentDetailRecord(publicId);
  if (!fixture) throw new Error("fixture missing");
  return { ...fixture, incident: { ...fixture.incident, status } };
}

describe("incident work stage view model", () => {
  it.each([
    ["NEW", "사건 확인"],
    ["ACKNOWLEDGED", "담당 지정"],
    ["CLAIMED", "검토"],
    ["UNDER_REVIEW", "판정"],
    ["DISPATCH_REQUESTED", "출동"],
    ["ON_SCENE", "현장 조치"],
    ["ACTION_IN_PROGRESS", "현장 조치"],
    ["ACTION_COMPLETED", "종료"],
  ] as const)("%s maps the current display step without inventing a server status", (status, label) => {
    expect(getIncidentWorkStages(record(status)).find((stage) => stage.state === "current")?.label).toBe(label);
  });

  it("marks false-positive dispatch and field steps as not applicable", () => {
    const stages = getIncidentWorkStages(record("FALSE_POSITIVE"));
    expect(stages.find((stage) => stage.id === "dispatch")?.state).toBe("skipped");
    expect(stages.find((stage) => stage.id === "field")?.state).toBe("skipped");
    expect(stages.find((stage) => stage.id === "close")?.state).toBe("done");
    expect(currentIncidentWorkStage(stages)).toBeNull();
    expect(incidentWorkStageFlow(stages)).toBe("모든 사건 처리 단계가 완료되었습니다.");
  });

  it("marks closed incidents as completed instead of forcing the last stage to current",()=>{
    const stages=getIncidentWorkStages(record("CLOSED"));
    expect(currentIncidentWorkStage(stages)).toBeNull();
    expect(stages.every(stage=>stage.state==="done"||stage.state==="skipped")).toBe(true);
    expect(incidentWorkStageFlow(stages)).toBe("모든 사건 처리 단계가 완료되었습니다.");
  });

  it("only exposes history data already present on the detail record", () => {
    const fixture = record("CLOSED");
    const stages = getIncidentWorkStages(fixture);
    expect(stages.filter((stage) => stage.history).every((stage) =>
      fixture.histories.some((history) => history.public_id === stage.history?.public_id),
    )).toBe(true);
  });

  it("derives the current action title and adjacent flow from the existing stage mapping",()=>{
    const acknowledged=getIncidentWorkStages(record("ACKNOWLEDGED"));
    expect(acknowledged.find(stage=>stage.state==="current")?.actionLabel).toBe("담당 관제자 지정");
    expect(incidentWorkStageFlow(acknowledged)).toBe("사건 확인 완료 · 다음 단계 검토");
    expect(incidentWorkStageFlow(getIncidentWorkStages(record("NEW")))).toBe("다음 단계 담당 지정");
    expect(incidentWorkStageFlow(getIncidentWorkStages(record("UNDER_REVIEW")))).toBe("검토 완료 · 판정 결과에 따라 출동 또는 종료");
    expect(incidentWorkStageFlow(getIncidentWorkStages(record("ACTION_COMPLETED")))).toBe("현장 조치 완료 · 최종 종료 단계");
  });
});
