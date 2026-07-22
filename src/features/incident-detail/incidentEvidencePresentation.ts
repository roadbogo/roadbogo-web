import type { NormalizedBBox } from "@/components/landing/DetectionOverlay";
import type { IncidentEvidence } from "./incidentDetailTypes";
import type { DashboardIncident } from "@/features/control-dashboard/dashboardTypes";

export function getEvidenceOverlayBbox(evidence: IncidentEvidence, view: "annotated" | "original" | "compare"): NormalizedBBox | null {
  if (view === "original") return null;
  if (view === "annotated" && evidence.annotated_image_url) return null;
  return evidence.bbox;
}

export function getRepresentativeOverlayBbox(incident:DashboardIncident | null): NormalizedBBox | null {
  return incident?.representative_image_kind === "ORIGINAL" ? incident.detection_bbox ?? null : null;
}
