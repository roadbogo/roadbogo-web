import { describe,expect,it } from "vitest";
import { getControlAccessHandoff } from "./accessHandoff";

describe("control access handoff",()=>{
  it("routes a general user to the existing public home",()=>{
    expect(getControlAccessHandoff(["GENERAL_USER"])?.destination).toBe("/");
  });
  it("routes a responder to the existing dispatch route",()=>{
    expect(getControlAccessHandoff(["RESPONDER"])?.destination).toBe("/dispatch");
  });
  it("keeps incomplete operational accounts on the restricted screen",()=>{
    expect(getControlAccessHandoff(["CONTROLLER"])).toBeNull();
    expect(getControlAccessHandoff(["CONTROL_MANAGER"])).toBeNull();
    expect(getControlAccessHandoff(["SYSTEM_ADMIN"])).toBeNull();
  });
  it("does not downgrade a mixed operational account to a lower-priority role",()=>{
    expect(getControlAccessHandoff(["CONTROLLER","GENERAL_USER"])).toBeNull();
  });
});
