import type { DashboardDispatch, DashboardIncident } from "./dashboardTypes";

const incidentOverrides = new Map<string, Partial<DashboardIncident>>();
const dispatchOverrides = new Map<string, DashboardDispatch>();

export function updateMockIncidentRuntime(publicId: string, patch: Partial<DashboardIncident>) {
  incidentOverrides.set(publicId, { ...incidentOverrides.get(publicId), ...patch });
}

export function applyMockIncidentRuntime(incident: DashboardIncident): DashboardIncident {
  const patch = incidentOverrides.get(incident.public_id);
  return patch ? { ...incident, ...patch } : incident;
}

export function updateMockDispatchRuntime(dispatch: DashboardDispatch) {
  dispatchOverrides.set(dispatch.incident_public_id, structuredClone(dispatch));
}

export function applyMockDispatchRuntime(dispatches: DashboardDispatch[]): DashboardDispatch[] {
  const runtimeIncidentIds = new Set(dispatchOverrides.keys());
  return [
    ...dispatches.filter(dispatch => !runtimeIncidentIds.has(dispatch.incident_public_id)),
    ...[...dispatchOverrides.values()].map(dispatch => structuredClone(dispatch)),
  ];
}

export function resetMockIncidentRuntime() {
  incidentOverrides.clear();
  dispatchOverrides.clear();
}
