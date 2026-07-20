import { describe, expect, it } from "vitest";
import {
  demoStagePresentation,
  demoWorkflow,
  getDemoStepMarker,
  getDemoStepState,
  primaryDemoStageKeys,
} from "./demoStagePresentation";

describe("demoStagePresentation", () => {
  it("keeps the current-work card and workflow on the same five-step model", () => {
    primaryDemoStageKeys.forEach((key, index) => {
      const presentation = demoStagePresentation[key];

      expect(presentation.step).toBe(index + 1);
      expect(presentation.workflowLabel).toBe(demoWorkflow[index]);
      expect(presentation.currentTitle).not.toBe("");
      expect(presentation.description).not.toBe("");
      expect(presentation.nextLabel).not.toBe("");
    });
  });

  it("uses result confirmation only after field action is complete", () => {
    const resultConfirmationStages = Object.entries(demoStagePresentation)
      .filter(([, value]) => value.currentTitle === "조치 결과 확인")
      .map(([key]) => key);

    expect(resultConfirmationStages).toEqual(["ACTION_COMPLETED"]);
  });

  it("derives completed, current, and pending states from one current step", () => {
    expect(demoWorkflow.map((_, index) => getDemoStepState(index, 2))).toEqual([
      "completed",
      "completed",
      "current",
      "pending",
      "pending",
    ]);
  });

  it("shows a check only for completed steps and numbers for the rest", () => {
    expect(getDemoStepMarker(0, "completed")).toBe("✓");
    expect(getDemoStepMarker(2, "current")).toBe("3");
    expect(getDemoStepMarker(4, "pending")).toBe("5");
  });
});
