import type { EvidenceViewMode } from "./EvidenceFocusDialog";

export interface EvidenceFocusLocation {
  open: boolean;
  evidenceId: string | null;
  mode: EvidenceViewMode | null;
}

export function readEvidenceFocus(search: string): EvidenceFocusLocation {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  return {
    open: params.get("view") === "evidence-focus",
    evidenceId: params.get("evidence"),
    mode: mode === "annotated" || mode === "original" || mode === "compare" ? mode : null,
  };
}

export function evidenceFocusUrl(
  pathname: string,
  search: string,
  evidenceId: string,
  mode: EvidenceViewMode,
) {
  const params = new URLSearchParams(search);
  params.set("view", "evidence-focus");
  params.set("evidence", evidenceId);
  params.set("mode", mode);
  return `${pathname}?${params}`;
}

export function evidenceFocusSelectionUrl(
  pathname: string,
  search: string,
  evidenceId: string,
) {
  const params = new URLSearchParams(search);
  params.set("evidence", evidenceId);
  return `${pathname}?${params}`;
}

export function evidenceFocusModeUrl(
  pathname: string,
  search: string,
  mode: EvidenceViewMode,
) {
  const params = new URLSearchParams(search);
  params.set("mode", mode);
  return `${pathname}?${params}`;
}

export function incidentDetailUrl(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  params.delete("view");
  params.delete("evidence");
  params.delete("mode");
  return `${pathname}${params.size ? `?${params}` : ""}`;
}
