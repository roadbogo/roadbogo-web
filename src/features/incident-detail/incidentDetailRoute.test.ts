import { describe, expect, it } from "vitest";
import { mockIncidentPublicIds } from "@/features/mocks/mockResourceIds";
import { incidentDetailPath, resolveIncidentDetailRoute } from "./incidentDetailRoute";

describe("incident detail route identifier",()=>{
  it("keeps a UUID resource identifier",()=>{
    const publicId=mockIncidentPublicIds["INC-20260719-0012"];
    expect(resolveIncidentDetailRoute(publicId,"api")).toEqual({kind:"valid",publicId});
    expect(incidentDetailPath(publicId)).toBe(`/control/incidents/${publicId}`);
    expect(()=>incidentDetailPath("INC-20260719-0012")).toThrow("INVALID_INCIDENT_PUBLIC_ID");
  });
  it("redirects an existing legacy incident number only in mock mode",()=>{
    expect(resolveIncidentDetailRoute("INC-20260719-0012","mock")).toEqual({kind:"redirect",publicId:mockIncidentPublicIds["INC-20260719-0012"]});
    expect(resolveIncidentDetailRoute("INC-20260719-0012","api")).toEqual({kind:"invalid"});
  });
  it("does not substitute an unknown incident",()=>{
    expect(resolveIncidentDetailRoute("INC-20990101-9999","mock")).toEqual({kind:"invalid"});
    expect(resolveIncidentDetailRoute("not-an-incident","api")).toEqual({kind:"invalid"});
  });
});
