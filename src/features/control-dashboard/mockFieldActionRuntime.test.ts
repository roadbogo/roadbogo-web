// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from "vitest";

const record={
  incidentPublicId:"incident-1",dispatchPublicId:"dispatch-1",responderLabel:"출동 담당자",actionType:"현장 조치",
  detail:"낙하물을 제거했습니다.",completedAt:"2026-08-05T00:00:00Z",beforeImageUrl:"blob:before",afterImageUrl:"/images/after.png",
};

describe("mockFieldActionRuntime",()=>{
  beforeEach(()=>{localStorage.clear();vi.resetModules()});

  it("keeps blob previews in memory during the SPA session but does not persist them",async()=>{
    const runtime=await import("./mockFieldActionRuntime");
    runtime.updateMockFieldActionRuntime(record);
    expect(runtime.getMockFieldActionRuntime(record.incidentPublicId)).toMatchObject({beforeImageUrl:"blob:before",afterImageUrl:"/images/after.png"});
    expect(JSON.parse(localStorage.getItem("roadbogo_mock_field_actions")??"[]")[0]).toMatchObject({beforeImageUrl:null,beforeImageExpired:true,afterImageUrl:"/images/after.png"});
  });

  it("drops legacy blob URLs when a refreshed runtime hydrates persisted data",async()=>{
    localStorage.setItem("roadbogo_mock_field_actions",JSON.stringify([record]));
    const runtime=await import("./mockFieldActionRuntime");
    expect(runtime.getMockFieldActionRuntime(record.incidentPublicId)).toMatchObject({beforeImageUrl:null,beforeImageExpired:true,afterImageUrl:"/images/after.png"});
  });
});
