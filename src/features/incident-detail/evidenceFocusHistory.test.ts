import { describe, expect, it } from "vitest";
import {
  evidenceFocusModeUrl,
  evidenceFocusSelectionUrl,
  evidenceFocusUrl,
  incidentDetailUrl,
  readEvidenceFocus,
} from "./evidenceFocusHistory";

describe("evidence focus history", () => {
  it("creates a restorable in-app focus URL while preserving unrelated query state", () => {
    const url = evidenceFocusUrl(
      "/control/incidents/incident-1",
      "?tab=memo",
      "evidence-2",
      "compare",
    );
    expect(url).toBe(
      "/control/incidents/incident-1?tab=memo&view=evidence-focus&evidence=evidence-2&mode=compare",
    );
    expect(readEvidenceFocus(url.slice(url.indexOf("?")))).toEqual({
      open: true,
      evidenceId: "evidence-2",
      mode: "compare",
    });
  });

  it("updates selected evidence and view without creating another history destination", () => {
    const search = "?view=evidence-focus&evidence=evidence-1&mode=annotated";
    expect(evidenceFocusSelectionUrl("/incident", search, "evidence-2")).toContain(
      "evidence=evidence-2",
    );
    expect(evidenceFocusModeUrl("/incident", search, "original")).toContain(
      "mode=original",
    );
  });

  it("removes only focus parameters when a direct focus URL is closed", () => {
    expect(
      incidentDetailUrl(
        "/control/incidents/incident-1",
        "?tab=memo&view=evidence-focus&evidence=evidence-2&mode=compare",
      ),
    ).toBe("/control/incidents/incident-1?tab=memo");
  });
});
