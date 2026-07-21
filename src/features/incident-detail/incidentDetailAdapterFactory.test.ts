import { describe, expect, it } from "vitest";
import { resolveDashboardDataMode } from "@/features/control-dashboard/dashboardAdapterFactory";

describe("incident detail adapter mode policy",()=>{
  it("uses the existing development-only mock policy",()=>{
    expect(resolveDashboardDataMode("development","true")).toBe("mock");
    expect(resolveDashboardDataMode("production","true")).toBe("api");
    expect(resolveDashboardDataMode("development","false")).toBe("api");
  });
});
