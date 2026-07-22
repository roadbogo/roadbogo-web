import { describe, expect, it } from "vitest";
import { getCompactProgressStates, progressStateLabel } from "./incidentProgress";

describe("incident compact progress", () => {
  it("marks every stage complete for closed incidents", () => {
    expect(getCompactProgressStates("CLOSED")).toEqual(["done", "done", "done", "done", "done", "done"]);
  });

  it("marks dispatch and field work unavailable but closure complete for false positives", () => {
    expect(getCompactProgressStates("FALSE_POSITIVE")).toEqual(["done", "done", "done", "skipped", "skipped", "done"]);
  });

  it("keeps closure pending after field action is completed", () => {
    expect(getCompactProgressStates("ACTION_COMPLETED")).toEqual(["done", "done", "done", "done", "done", "pending"]);
  });

  it("keeps the active operational stage current", () => {
    expect(getCompactProgressStates("UNDER_REVIEW")).toEqual(["done", "done", "current", "pending", "pending", "pending"]);
    expect(getCompactProgressStates("ON_SCENE")).toEqual(["done", "done", "done", "done", "current", "pending"]);
  });

  it("provides distinct accessible text for every visual state", () => {
    expect(progressStateLabel).toEqual({ done: "완료", current: "현재", pending: "대기", skipped: "해당 없음" });
  });
});
