import {describe,expect,it,vi} from "vitest";
import type {IncidentDetailRecord} from "./incidentDetailTypes";
import {applyClosureCommandResult,closureRefreshWarning,refreshIncidentAfterClosure} from "./incidentClosureSync";

const closed={incident:{status:"CLOSED"}} as IncidentDetailRecord;

describe("refreshIncidentAfterClosure",()=>{
  it("preserves the close response timestamp while a detail refresh is unavailable",()=>{
    const current={...closed,closed_at:null,incident:{...closed.incident,status:"ACTION_COMPLETED",version_no:8,updated_at:"2026-07-20T00:00:00Z"}} as IncidentDetailRecord;
    expect(applyClosureCommandResult(current,{ok:true,status:"CLOSED",version_no:9,closed_at:"2026-07-21T01:00:00Z"})).toMatchObject({closed_at:"2026-07-21T01:00:00Z",incident:{status:"CLOSED",version_no:9,updated_at:"2026-07-21T01:00:00Z"}});
  });

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
