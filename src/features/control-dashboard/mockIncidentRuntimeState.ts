import type { DashboardIncident } from "./dashboardTypes";

const incidentOverrides = new Map<string, Partial<DashboardIncident>>();

export function updateMockIncidentRuntime(publicId: string, patch: Partial<DashboardIncident>) {
  incidentOverrides.set(publicId, { ...incidentOverrides.get(publicId), ...patch });
}

export function applyMockIncidentRuntime(incident: DashboardIncident): DashboardIncident {
  const patch = incidentOverrides.get(incident.public_id);
  return patch ? { ...incident, ...patch } : incident;
}
