import {describe,expect,it} from "vitest";
import {MockAdminAuditLogRepository} from "./mockAuditLogRepository";
import type {AuditQuery} from "./auditLogTypes";

const query:AuditQuery={
  mode:"trace",
  quick:"ALL",
  period:"30d",
  actorType:"ALL",
  actionGroup:"ALL",
  resourceType:"ALL",
  result:"ALL",
  keyword:"",
  page:1,
  size:20,
  traceId:null,
  auditId:null,
};

describe("MockAdminAuditLogRepository",()=>{
  it("groups records with the same trace and preserves trace-less records independently",async()=>{
    const repository=new MockAdminAuditLogRepository();
    const result=await repository.getFlows(query);
    const roleFlow=result.items.find(item=>item.traceId==="9ac3b754-e04d-4f2b-a377-47f18d76c1fa");
    expect(roleFlow?.recordCount).toBe(3);
    expect(result.items.filter(item=>item.traceId===null)).toHaveLength(2);
  });

  it("uses the worst result as the trace result",async()=>{
    const repository=new MockAdminAuditLogRepository();
    const result=await repository.getFlows(query);
    expect(result.items.find(item=>item.traceId==="703768d6-99b4-4804-95e3-9e487bfcbb61")?.result).toBe("FAILURE");
  });

  it("filters denied and failed records with the quick filter",async()=>{
    const repository=new MockAdminAuditLogRepository();
    const result=await repository.getRecords({...query,mode:"record",quick:"FAILED"});
    expect(result.items).not.toHaveLength(0);
    expect(result.items.every(item=>item.result==="FAILURE"||item.result==="DENIED")).toBe(true);
  });

  it("searches public identifiers and action codes",async()=>{
    const repository=new MockAdminAuditLogRepository();
    const byResource=await repository.getRecords({...query,mode:"record",keyword:"dispatch-31"});
    const byAction=await repository.getRecords({...query,mode:"record",keyword:"USER.DEACTIVATE"});
    expect(byResource.items[0]?.publicId).toBe("audit-dispatch-fail");
    expect(byAction.items[0]?.publicId).toBe("audit-disable");
  });
});
