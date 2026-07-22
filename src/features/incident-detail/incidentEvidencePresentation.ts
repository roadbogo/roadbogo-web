import type { NormalizedBBox } from "@/components/landing/DetectionOverlay";
import type { IncidentEvidence } from "./incidentDetailTypes";

export function getEvidenceOverlayBbox(evidence: IncidentEvidence, view: "annotated" | "original" | "compare"): NormalizedBBox | null {
  if (view === "original") return null;
  if (view === "annotated" && evidence.annotated_image_url) return null;
  return evidence.bbox;
}
