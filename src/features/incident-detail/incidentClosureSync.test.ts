import {describe,expect,it,vi} from "vitest";
import type {IncidentDetailRecord} from "./incidentDetailTypes";
import {closureRefreshWarning,refreshIncidentAfterClosure} from "./incidentClosureSync";

const closed={incident:{status:"CLOSED"}} as IncidentDetailRecord;

describe("refreshIncidentAfterClosure",()=>{
  it("returns the refreshed closed incident after closure",async()=>{
    const get=vi.fn().mockResolvedValue(closed);
    await expect(refreshIncidentAfterClosure(get)).resolves.toEqual({record:closed,warning:""});
  });

  it.each([null,new Error("refresh failed")])("keeps closure successful when refresh cannot provide detail",async failure=>{
    const get=vi.fn().mockImplementation(()=>failure instanceof Error?Promise.reject(failure):Promise.resolve(failure));
    await expect(refreshIncidentAfterClosure(get)).resolves.toEqual({record:null,warning:closureRefreshWarning});
  });

  it("uses a command response record without another request",async()=>{
    const get=vi.fn();
    await expect(refreshIncidentAfterClosure(get,closed)).resolves.toEqual({record:closed,warning:""});
    expect(get).not.toHaveBeenCalled();
  });
});
